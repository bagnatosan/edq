using edq.Data;
using edq.DTO;
using edq.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace edq.Services;

public class GroupService : IGroupService
{
    private readonly ApplicationDbContext _context;

    public GroupService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<(List<GroupDto> MyGroups, List<GroupDto> OtherGroups)> GetGroupsAsync(int userId, string? search, int skip, int take)
    {
        // 1. Mis Grupos (Creador o miembro regular)
        var myGroupsQuery = _context.Groups
            .Include(g => g.Creator)
            .Include(g => g.GroupPlayers)
            .Where(g => g.CreatorId == userId || g.GroupPlayers.Any(gp => gp.PlayerId == userId));

        var myGroups = await myGroupsQuery
            .OrderBy(g => g.Name)
            .ToListAsync();

        var myGroupsResult = myGroups.Select(g => new GroupDto
        {
            Id = g.Id,
            Name = g.Name,
            CreatorName = g.Creator != null ? (g.Creator.Nickname ?? $"{g.Creator.Name} {g.Creator.LastName}") : "Desconocido",
            MemberCount = g.GroupPlayers.Count,
            IsCreator = g.CreatorId == userId,
            IsMember = true,
            RequestStatus = null
        }).ToList();

        // 2. Otros Grupos (Descubrir) - Paginado y Filtrable
        var otherGroupsQuery = _context.Groups
            .Include(g => g.Creator)
            .Include(g => g.GroupPlayers)
            .Where(g => g.CreatorId != userId && !g.GroupPlayers.Any(gp => gp.PlayerId == userId));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.Trim().ToLower();
            otherGroupsQuery = otherGroupsQuery.Where(g => g.Name.ToLower().Contains(searchLower));
        }

        var otherGroups = await otherGroupsQuery
            .OrderBy(g => g.Name)
            .Skip(skip)
            .Take(take)
            .ToListAsync();

        var otherGroupIds = otherGroups.Select(g => g.Id).ToList();

        // Obtener el estado de solicitudes del usuario actual para estos grupos
        var userRequests = await _context.Requests
            .Where(r => r.PlayerId == userId && otherGroupIds.Contains(r.GroupId))
            .ToDictionaryAsync(r => r.GroupId, r => r.State);

        var otherGroupsResult = otherGroups.Select(g => new GroupDto
        {
            Id = g.Id,
            Name = g.Name,
            CreatorName = g.Creator != null ? (g.Creator.Nickname ?? $"{g.Creator.Name} {g.Creator.LastName}") : "Desconocido",
            MemberCount = g.GroupPlayers.Count,
            IsCreator = false,
            IsMember = false,
            RequestStatus = userRequests.TryGetValue(g.Id, out var status) ? status : null
        }).ToList();

        return (myGroupsResult, otherGroupsResult);
    }

    public async Task<JoinRequestResult> RequestJoinGroupAsync(int userId, int groupId)
    {
        var group = await _context.Groups.FindAsync(groupId);
        if (group == null)
        {
            return JoinRequestResult.GroupNotFound;
        }

        // Check if creator
        if (group.CreatorId == userId)
        {
            return JoinRequestResult.IsCreator;
        }

        // Check if member
        var isMember = await _context.GroupPlayers.AnyAsync(gp => gp.GroupId == groupId && gp.PlayerId == userId);
        if (isMember)
        {
            return JoinRequestResult.AlreadyMember;
        }

        var realUser = await _context.Players.FindAsync(userId);
        if (realUser == null)
        {
            return JoinRequestResult.GroupNotFound;
        }

        // Buscar jugador temporal EN ESTE GRUPO con el mismo Nombre y Apellido
        var dummyPlayerInGroup = await _context.GroupPlayers
            .Include(gp => gp.Player)
            .FirstOrDefaultAsync(gp => gp.GroupId == groupId 
                                 && gp.Player!.Email.EndsWith("@edq.temp")
                                 && gp.Player.Name.ToLower() == realUser.Name.ToLower()
                                 && gp.Player.LastName.ToLower() == realUser.LastName.ToLower());

        if (dummyPlayerInGroup != null)
        {
            var dummyPlayerId = dummyPlayerInGroup.PlayerId;
            var score = dummyPlayerInGroup.Score;

            // Eliminar la relación del jugador temporal en el grupo
            _context.GroupPlayers.Remove(dummyPlayerInGroup);

            // Crear la relación para el jugador real con el mismo puntaje
            var newGp = new GroupPlayer
            {
                GroupId = groupId,
                PlayerId = userId,
                Score = score
            };
            _context.GroupPlayers.Add(newGp);

            // Migrar participaciones en partidos (MatchPlayers) para este jugador temporal
            var matchPlayersToMigrate = await _context.MatchPlayers
                .Where(mp => mp.PlayerId == dummyPlayerId)
                .ToListAsync();

            foreach (var mp in matchPlayersToMigrate)
            {
                var alreadyInMatch = await _context.MatchPlayers
                    .AnyAsync(realMp => realMp.MatchId == mp.MatchId && realMp.PlayerId == userId);

                if (!alreadyInMatch)
                {
                    var newMp = new MatchPlayer
                    {
                        MatchId = mp.MatchId,
                        PlayerId = userId,
                        Team = mp.Team
                    };
                    _context.MatchPlayers.Add(newMp);
                }
                _context.MatchPlayers.Remove(mp);
            }

            // Eliminar el jugador temporal del sistema
            if (dummyPlayerInGroup.Player != null)
            {
                _context.Players.Remove(dummyPlayerInGroup.Player);
            }

            await _context.SaveChangesAsync();
            return JoinRequestResult.SuccessApproved;
        }

        var request = new Request
        {
            GroupId = groupId,
            PlayerId = userId,
            DateRequest = DateTime.UtcNow,
            State = "Pending"
        };

        try
        {
            _context.Requests.Add(request);
            await _context.SaveChangesAsync();
            return JoinRequestResult.SuccessPending;
        }
        catch (DbUpdateException)
        {
            return JoinRequestResult.AlreadyRequested;
        }
    }

    public async Task<bool> CanAccessDashboardAsync(int userId, int groupId)
    {
        return await _context.Groups.AnyAsync(g => g.Id == groupId && g.CreatorId == userId)
            || await _context.GroupPlayers.AnyAsync(gp => gp.GroupId == groupId && gp.PlayerId == userId);
    }

    public async Task<GroupDashboardDto?> GetGroupDashboardDataAsync(int userId, int groupId)
    {
        var group = await _context.Groups
            .Include(g => g.Creator)
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null)
        {
            return null;
        }

        var isCreator = group.CreatorId == userId;
        var isMember = await _context.GroupPlayers.AnyAsync(gp => gp.GroupId == groupId && gp.PlayerId == userId);

        if (!isCreator && !isMember)
        {
            return null;
        }

        // Obtener miembros del grupo
        var groupPlayers = await _context.GroupPlayers
            .Include(gp => gp.Player)
            .Where(gp => gp.GroupId == groupId)
            .ToListAsync();

        // Obtener partidos finalizados para calcular winrates
        var completedMatches = await _context.Matches
            .Include(m => m.MatchPlayers)
            .Where(m => m.GroupId == groupId && m.State != "Pending")
            .ToListAsync();

        var playerWinStats = new Dictionary<int, (int Played, int Won)>();
        foreach (var match in completedMatches)
        {
            var parts = match.State.Split('-');
            if (parts.Length != 2 || !int.TryParse(parts[0].Trim(), out var score1) || !int.TryParse(parts[1].Trim(), out var score2))
            {
                continue;
            }

            var teams = match.MatchPlayers
                .GroupBy(mp => mp.Team)
                .OrderBy(g => g.Key)
                .ToList();

            if (teams.Count < 2) continue;

            var team1Players = teams[0].Select(mp => mp.PlayerId).ToHashSet();
            var team2Players = teams[1].Select(mp => mp.PlayerId).ToHashSet();

            int winningTeam = score1 > score2 ? 1 : (score2 > score1 ? 2 : 0);

            foreach (var playerId in team1Players)
            {
                playerWinStats.TryGetValue(playerId, out var stats);
                stats.Played++;
                if (winningTeam == 1) stats.Won++;
                playerWinStats[playerId] = stats;
            }

            foreach (var playerId in team2Players)
            {
                playerWinStats.TryGetValue(playerId, out var stats);
                stats.Played++;
                if (winningTeam == 2) stats.Won++;
                playerWinStats[playerId] = stats;
            }
        }

        var members = groupPlayers.Select(gp =>
        {
            playerWinStats.TryGetValue(gp.PlayerId, out var stats);
            double winrate = stats.Played > 0 ? ((double)stats.Won / stats.Played) * 100.0 : 0.0;
            return new GroupMemberDto
            {
                Id = gp.PlayerId,
                Name = $"{gp.Player!.Name} {gp.Player.LastName}",
                Nickname = gp.Player.Nickname ?? gp.Player.Name,
                PhotoUrl = gp.Player.PhotoUrl,
                Initials = gp.Player.Initials,
                Score = gp.Score,
                Winrate = Math.Round(winrate, 1)
            };
        })
        .OrderByDescending(m => m.Winrate)
        .ThenBy(m => m.Name)
        .ToList();

        // Obtener solicitudes pendientes si es administrador
        List<PendingRequestDto>? pendingRequests = null;
        if (isCreator)
        {
            pendingRequests = await _context.Requests
                .Include(r => r.Player)
                .Where(r => r.GroupId == groupId && r.State == "Pending")
                .OrderBy(r => r.DateRequest)
                .Select(r => new PendingRequestDto
                {
                    RequestId = r.Id,
                    PlayerId = r.PlayerId,
                    Name = $"{r.Player!.Name} {r.Player.LastName}",
                    Nickname = r.Player.Nickname ?? r.Player.Name,
                    PhotoUrl = r.Player.PhotoUrl,
                    Initials = r.Player.Initials
                })
                .ToListAsync();
        }

        // Obtener próximo partido
        var upcomingMatch = await _context.Matches
            .Include(m => m.MatchPlayers)
                .ThenInclude(mp => mp.Player)
            .Where(m => m.GroupId == groupId && m.Date > DateTime.UtcNow && m.State == "Pending")
            .OrderBy(m => m.Date)
            .FirstOrDefaultAsync();

        UpcomingMatchDto? upcomingMatchDto = null;
        if (upcomingMatch != null)
        {
            var teams = upcomingMatch.MatchPlayers
                .GroupBy(mp => mp.Team)
                .OrderBy(g => g.Key)
                .ToList();

            var team1 = teams.Count > 0 
                ? teams[0].Select(mp => mp.Player != null ? (mp.Player.Nickname ?? mp.Player.Name) : "Desconocido").ToList() 
                : new List<string>();

            var team2 = teams.Count > 1 
                ? teams[1].Select(mp => mp.Player != null ? (mp.Player.Nickname ?? mp.Player.Name) : "Desconocido").ToList() 
                : new List<string>();

            upcomingMatchDto = new UpcomingMatchDto
            {
                Id = upcomingMatch.Id,
                Date = upcomingMatch.Date,
                Team1 = team1,
                Team2 = team2
            };
        }

        return new GroupDashboardDto
        {
            GroupId = group.Id,
            GroupName = group.Name,
            IsCreator = isCreator,
            Members = members,
            PendingRequests = pendingRequests,
            UpcomingMatch = upcomingMatchDto
        };
    }

    public async Task<bool> AcceptRequestAsync(int userId, int requestId)
    {
        var request = await _context.Requests
            .Include(r => r.Group)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request == null)
        {
            return false;
        }

        if (request.Group == null || request.Group.CreatorId != userId)
        {
            return false;
        }

        if (request.State != "Pending")
        {
            return false;
        }

        // Agregar a la tabla de relación si no existe
        var exists = await _context.GroupPlayers.AnyAsync(gp => gp.GroupId == request.GroupId && gp.PlayerId == request.PlayerId);
        if (!exists)
        {
            var newMember = new GroupPlayer
            {
                GroupId = request.GroupId,
                PlayerId = request.PlayerId,
                Score = 6 // Calificación inicial por defecto 6.0
            };
            _context.GroupPlayers.Add(newMember);
        }

        // Marcar solicitud como aceptada
        request.State = "Approved";
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> DeclineRequestAsync(int userId, int requestId)
    {
        var request = await _context.Requests
            .Include(r => r.Group)
            .FirstOrDefaultAsync(r => r.Id == requestId);

        if (request == null)
        {
            return false;
        }

        if (request.Group == null || request.Group.CreatorId != userId)
        {
            return false;
        }

        if (request.State != "Pending")
        {
            return false;
        }

        // Marcar solicitud como rechazada
        request.State = "Rejected";
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> UpdateMemberScoresAsync(int userId, int groupId, List<MemberScoreUpdateDto> updates)
    {
        var group = await _context.Groups.FindAsync(groupId);
        if (group == null || group.CreatorId != userId)
        {
            return false;
        }

        foreach (var update in updates)
        {
            var gp = await _context.GroupPlayers
                .FirstOrDefaultAsync(x => x.GroupId == groupId && x.PlayerId == update.PlayerId);
            
            if (gp != null)
            {
                gp.Score = update.Score;
            }
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CreateTemporaryPlayerAsync(int userId, int groupId, string name, string lastName, byte initialScore)
    {
        var group = await _context.Groups.FindAsync(groupId);
        if (group == null || group.CreatorId != userId)
        {
            return false;
        }

        var dummyPlayer = new Player
        {
            Name = name.Trim(),
            LastName = lastName.Trim(),
            Email = $"dummy_{Guid.NewGuid().ToString("N")}@edq.temp",
            Password = "DUMMY_PASSWORD"
        };

        _context.Players.Add(dummyPlayer);
        await _context.SaveChangesAsync();

        var gp = new GroupPlayer
        {
            GroupId = groupId,
            PlayerId = dummyPlayer.Id,
            Score = initialScore
        };

        _context.GroupPlayers.Add(gp);
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<List<MatchHistoryDto>?> GetMatchHistoryAsync(int userId, int groupId)
    {
        var belongs = await CanAccessDashboardAsync(userId, groupId);
        if (!belongs)
        {
            return null;
        }

        var matches = await _context.Matches
            .Include(m => m.MatchPlayers)
                .ThenInclude(mp => mp.Player)
            .Where(m => m.GroupId == groupId && m.State != "Pending")
            .OrderByDescending(m => m.Date)
            .ToListAsync();

        return matches.Select(m => {
            var teams = m.MatchPlayers
                .GroupBy(mp => mp.Team)
                .OrderBy(g => g.Key)
                .ToList();

            var team1 = teams.Count > 0 
                ? teams[0].Select(mp => mp.Player != null ? (mp.Player.Nickname ?? mp.Player.Name) : "Desconocido").ToList() 
                : new List<string>();

            var team2 = teams.Count > 1 
                ? teams[1].Select(mp => mp.Player != null ? (mp.Player.Nickname ?? mp.Player.Name) : "Desconocido").ToList() 
                : new List<string>();

            return new MatchHistoryDto
            {
                MatchId = m.Id,
                Date = m.Date,
                Result = m.State,
                Team1 = team1,
                Team2 = team2
            };
        }).ToList();
    }

    public async Task<bool> UpdateGroupNameAsync(int userId, int groupId, string newName)
    {
        var group = await _context.Groups.FindAsync(groupId);
        if (group == null || group.CreatorId != userId)
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(newName))
        {
            return false;
        }

        group.Name = newName.Trim();
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveMemberAsync(int userId, int groupId, int playerId)
    {
        // 1. Validar que el usuario que remueve sea el creador del grupo
        var group = await _context.Groups.FindAsync(groupId);
        if (group == null || group.CreatorId != userId)
        {
            return false;
        }

        // 2. El creador no puede auto-eliminarse
        if (group.CreatorId == playerId)
        {
            return false;
        }

        // 3. Buscar al miembro en la relación GroupPlayer
        var gp = await _context.GroupPlayers
            .FirstOrDefaultAsync(x => x.GroupId == groupId && x.PlayerId == playerId);

        if (gp == null)
        {
            return false;
        }

        // 4. Eliminar el registro de membresía
        _context.GroupPlayers.Remove(gp);

        // 5. Eliminarlo de participaciones en partidos pendientes (futuros) de este grupo
        var pendingMatchIds = await _context.Matches
            .Where(m => m.GroupId == groupId && m.State == "Pending")
            .Select(m => m.Id)
            .ToListAsync();

        if (pendingMatchIds.Any())
        {
            var matchPlayersToRemove = await _context.MatchPlayers
                .Where(mp => mp.PlayerId == playerId && pendingMatchIds.Contains(mp.MatchId))
                .ToListAsync();

            if (matchPlayersToRemove.Any())
            {
                _context.MatchPlayers.RemoveRange(matchPlayersToRemove);
            }
        }

        // 6. Eliminar solicitudes de unión (aprobadas o pendientes) para este grupo
        var requests = await _context.Requests
            .Where(r => r.GroupId == groupId && r.PlayerId == playerId)
            .ToListAsync();

        if (requests.Any())
        {
            _context.Requests.RemoveRange(requests);
        }

        await _context.SaveChangesAsync();
        return true;
     }

    public async Task<int> CreateGroupAsync(int creatorId, string name)
    {
        var group = new Group
        {
            Name = name,
            CreatorId = creatorId
        };
        _context.Groups.Add(group);
        await _context.SaveChangesAsync();

        var groupPlayer = new GroupPlayer
        {
            GroupId = group.Id,
            PlayerId = creatorId,
            Score = 6
        };
        _context.GroupPlayers.Add(groupPlayer);
        await _context.SaveChangesAsync();

        return group.Id;
    }

    public async Task<bool> IsGroupCreatorAsync(int userId, int groupId)
    {
        var group = await _context.Groups.FindAsync(groupId);
        return group != null && group.CreatorId == userId;
    }
}


