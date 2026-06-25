using edq.Data;
using edq.DTO;
using edq.Models;
using Microsoft.EntityFrameworkCore;

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
        // 1. Mis Grupos (Creador o miembro regular) - Proyección directa optimizada
        var myGroupsResult = await _context.Groups
            .Where(g => g.CreatorId == userId || g.GroupPlayers.Any(gp => gp.PlayerId == userId))
            .OrderBy(g => g.Name)
            .Select(g => new GroupDto
            {
                Id = g.Id,
                Name = g.Name,
                CreatorName = g.Creator != null ? g.Creator.Name + " " + g.Creator.LastName : "Desconocido",
                MemberCount = g.GroupPlayers.Count,
                IsCreator = g.CreatorId == userId,
                IsMember = true,
                RequestStatus = null
            })
            .ToListAsync();

        // 2. Otros Grupos (Descubrir) - Paginado y Filtrable - Proyección directa optimizada
        var otherGroupsQuery = _context.Groups
            .Where(g => g.CreatorId != userId && !g.GroupPlayers.Any(gp => gp.PlayerId == userId));

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.Trim().ToLower();
            otherGroupsQuery = otherGroupsQuery.Where(g => g.Name.ToLower().Contains(searchLower));
        }

        var otherGroupsResult = await otherGroupsQuery
            .OrderBy(g => g.Name)
            .Skip(skip)
            .Take(take)
            .Select(g => new GroupDto
            {
                Id = g.Id,
                Name = g.Name,
                CreatorName = g.Creator != null ? g.Creator.Name + " " + g.Creator.LastName : "Desconocido",
                MemberCount = g.GroupPlayers.Count,
                IsCreator = false,
                IsMember = false,
                RequestStatus = null
            })
            .ToListAsync();

        var otherGroupIds = otherGroupsResult.Select(g => g.Id).ToList();

        // Obtener el estado de solicitudes del usuario actual para estos grupos
        var userRequests = await _context.Requests.AsNoTracking()
            .Where(r => r.PlayerId == userId && otherGroupIds.Contains(r.GroupId))
            .ToDictionaryAsync(r => r.GroupId, r => r.State);

        // Asignar el estado de las solicitudes en memoria local
        foreach (var groupDto in otherGroupsResult)
        {
            if (userRequests.TryGetValue(groupDto.Id, out var status))
            {
                groupDto.RequestStatus = status;
            }
        }

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

        var realUser = await _context.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Id == userId);
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
        // 1. Obtener datos básicos del grupo (Sin incluir Creator completo)
        var group = await _context.Groups.AsNoTracking()
            .Select(g => new { g.Id, g.Name, g.CreatorId })
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null)
            return null;

        var isCreator = group.CreatorId == userId;
        var isMember = await _context.GroupPlayers.AnyAsync(gp => gp.GroupId == groupId && gp.PlayerId == userId);

        if (!isCreator && !isMember)
            return null;
        

        // 2. Obtener miembros del grupo con proyección limpia de campos
        var groupPlayersData = await _context.GroupPlayers.AsNoTracking()
            .Where(gp => gp.GroupId == groupId)
            .Select(gp => new
            {
                gp.PlayerId,
                gp.Score,
                PlayerName = gp.Player != null ? gp.Player.Name : "",
                PlayerLastName = gp.Player != null ? gp.Player.LastName : "",
                PlayerNickname = gp.Player != null ? gp.Player.Nickname : "",
                PlayerPhotoUrl = gp.Player != null ? gp.Player.PhotoUrl : null,
                PlayerInitials = gp.Player != null ? gp.Player.Initials : ""
            })
            .ToListAsync();

        // 3. Obtener datos ligeros de partidos finalizados para winrate
        var completedMatchesData = await _context.Matches.AsNoTracking()
            .Where(m => m.GroupId == groupId && m.State != "Pending")
            .Select(m => new
            {
                m.State,
                MatchPlayers = m.MatchPlayers.Select(mp => new { mp.Team, mp.PlayerId }).ToList()
            })
            .ToListAsync();

        var playerWinStats = new Dictionary<int, (int Played, int Won)>();
        foreach (var match in completedMatchesData)
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

        var members = groupPlayersData.Select(gp =>
        {
            playerWinStats.TryGetValue(gp.PlayerId, out var stats);
            double winrate = stats.Played > 0 ? ((double)stats.Won / stats.Played) * 100.0 : 0.0;
            var fullName = $"{gp.PlayerName} {gp.PlayerLastName}";
            return new GroupMemberDto
            {
                Id = gp.PlayerId,
                Name = fullName,
                Nickname = !string.IsNullOrWhiteSpace(gp.PlayerNickname) ? gp.PlayerNickname : fullName,
                PhotoUrl = gp.PlayerPhotoUrl,
                Initials = gp.PlayerInitials,
                Score = gp.Score,
                Winrate = Math.Round(winrate, 1)
            };
        })
        .OrderByDescending(m => m.Winrate)
        .ThenBy(m => m.Name)
        .ToList();

        // 4. Obtener solicitudes pendientes si es administrador
        List<PendingRequestDto>? pendingRequests = null;
        if (isCreator)
        {
            pendingRequests = await _context.Requests.AsNoTracking()
                .Where(r => r.GroupId == groupId && r.State == "Pending")
                .OrderBy(r => r.DateRequest)
                .Select(r => new PendingRequestDto
                {
                    RequestId = r.Id,
                    PlayerId = r.PlayerId,
                    Name = r.Player != null ? r.Player.Name + " " + r.Player.LastName : "Desconocido",
                    Nickname = r.Player != null ? (!string.IsNullOrWhiteSpace(r.Player.Nickname) ? r.Player.Nickname : r.Player.Name + " " + r.Player.LastName) : "Desconocido",
                    PhotoUrl = r.Player != null ? r.Player.PhotoUrl : null,
                    Initials = r.Player != null ? r.Player.Initials : ""
                })
                .ToListAsync();
        }

        // 5. Obtener próximo partido con proyección directa
        var upcomingMatchDto = await _context.Matches.AsNoTracking()
            .Where(m => m.GroupId == groupId && m.State == "Pending")
            .OrderBy(m => m.Date)
            .Select(m => new UpcomingMatchDto
            {
                Id = m.Id,
                Date = m.Date,
                Team1 = m.MatchPlayers
                    .Where(mp => mp.Team == 1)
                    .Select(mp => mp.Player != null 
                        ? (!string.IsNullOrWhiteSpace(mp.Player.Nickname) ? mp.Player.Nickname : mp.Player.Name + " " + mp.Player.LastName) 
                        : "Desconocido")
                    .ToList(),
                Team2 = m.MatchPlayers
                    .Where(mp => mp.Team == 2)
                    .Select(mp => mp.Player != null 
                        ? (!string.IsNullOrWhiteSpace(mp.Player.Nickname) ? mp.Player.Nickname : mp.Player.Name + " " + mp.Player.LastName) 
                        : "Desconocido")
                    .ToList()
            })
            .FirstOrDefaultAsync();

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
            return false;
        

        if (request.Group == null || request.Group.CreatorId != userId)
            return false;

        if (request.State != "Pending")
            return false;
        

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
            return false;
        

        if (request.Group == null || request.Group.CreatorId != userId)
            return false;
        

        if (request.State != "Pending")
            return false;
        

        // Marcar solicitud como rechazada
        request.State = "Rejected";
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> UpdateMemberScoresAsync(int userId, int groupId, List<MemberScoreUpdateDto> updates)
    {
        var group = await _context.Groups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == groupId);
        if (group == null || group.CreatorId != userId)
            return false;
        

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
        var group = await _context.Groups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == groupId);
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

        // Proyección directa optimizada
        return await _context.Matches.AsNoTracking()
            .Where(m => m.GroupId == groupId && m.State != "Pending")
            .OrderByDescending(m => m.Date)
            .Select(m => new MatchHistoryDto
            {
                MatchId = m.Id,
                Date = m.Date,
                Result = m.State,
                Team1 = m.MatchPlayers
                    .Where(mp => mp.Team == 1)
                    .Select(mp => mp.Player != null 
                        ? (!string.IsNullOrWhiteSpace(mp.Player.Nickname) ? mp.Player.Nickname : mp.Player.Name + " " + mp.Player.LastName) 
                        : "Desconocido")
                    .ToList(),
                Team2 = m.MatchPlayers
                    .Where(mp => mp.Team == 2)
                    .Select(mp => mp.Player != null 
                        ? (!string.IsNullOrWhiteSpace(mp.Player.Nickname) ? mp.Player.Nickname : mp.Player.Name + " " + mp.Player.LastName) 
                        : "Desconocido")
                    .ToList()
            })
            .ToListAsync();
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
        var group = await _context.Groups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == groupId);
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
        var pendingMatchIds = await _context.Matches.AsNoTracking()
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
        var group = await _context.Groups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == groupId);
        return group != null && group.CreatorId == userId;
    }
}


