using edq.Data;
using edq.DTO;
using edq.Models;
using Microsoft.EntityFrameworkCore;

namespace edq.Services;

public class MatchService : IMatchService
{
    private readonly ApplicationDbContext _context;

    public MatchService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<UserUpcomingMatchDto>> GetUpcomingMatchesForUserAsync(int userId)
    {
        // 1. Obtener los IDs de los grupos en los que participa el usuario (como creador o miembro)
        var userGroupIds = await _context.Groups.AsNoTracking()
            .Where(g => g.CreatorId == userId || g.GroupPlayers.Any(gp => gp.PlayerId == userId))
            .Select(g => g.Id)
            .ToListAsync();

        if (userGroupIds.Count == 0)
        {
            return new List<UserUpcomingMatchDto>();
        }

        // 2. Obtener todos los partidos de esos grupos que estén pendientes
        var upcomingMatches = await _context.Matches.AsNoTracking()
            .Include(m => m.Group)
            .Include(m => m.MatchPlayers)
                .ThenInclude(mp => mp.Player)
            .Where(m => userGroupIds.Contains(m.GroupId) && m.State == "Pending")
            
            .OrderBy(m => m.Date)
            .ToListAsync();


        return await _context.Matches
            .Where(m => userGroupIds.Contains(m.GroupId) && m.State == "Pending")
            .OrderBy(m => m.Date)
            .Select(m => new UserUpcomingMatchDto()
            {
                MatchId = m.Id,
                GroupId = m.GroupId,
                GroupName = m.Group != null ? m.Group.Name : "Grupo Desconocido",
                Date = m.Date,

                Team1 = m.MatchPlayers.Where(mp => mp.Player != null)
                    .Select(mp => mp.Player != null
                        ? (!string.IsNullOrWhiteSpace(mp.Player.Nickname)
                            ? mp.Player.Nickname
                            : $"{mp.Player.Name} {mp.Player.LastName}")
                        : "Desconocido")
                    .ToList(),
                Team2 = m.MatchPlayers.Where(mp => mp.Player != null)
                    .Select(mp => mp.Player != null
                        ? (!string.IsNullOrWhiteSpace(mp.Player.Nickname)
                            ? mp.Player.Nickname
                            : $"{mp.Player.Name} {mp.Player.LastName}")
                        : "Desconocido")
                    .ToList()
            })
            .ToListAsync();
    }
    
    
    public async Task<MatchDetailsDto?> GetMatchDetailsAsync(int matchId, int userId)
    {
        var match = await _context.Matches.AsNoTracking()
            .Include(m => m.Group)
            .Include(m => m.MatchPlayers)
                .ThenInclude(mp => mp.Player)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return null;

        // Validar acceso: el usuario debe ser creador o miembro del grupo
        var isMember = await IsUserInGroupAsync(match, userId);

        if (!isMember) return null;

        var isCreator = true; // Cualquier miembro del grupo tiene permisos de edición (equivalente a creador para la vista)

        // Obtener todos los miembros del grupo para permitir agregar/sacar
        var groupMembers = await _context.GroupPlayers.AsNoTracking()
            .Include(gp => gp.Player)
            .Where(gp => gp.GroupId == match.GroupId)
            .ToListAsync();

        return new MatchDetailsDto
        {
            MatchId = match.Id,
            GroupId = match.GroupId,
            GroupName = match.Group?.Name ?? "Grupo Desconocido",
            Date = match.Date,
            State = match.State,
            IsCreator = isCreator,
            MatchPlayers = match.MatchPlayers.Select(mp => new MatchPlayerDetailsDto
            {
                PlayerId = mp.PlayerId,
                Name = mp.Player != null ? $"{mp.Player.Name} {mp.Player.LastName}" : "Desconocido",
                Nickname = mp.Player != null ? (!string.IsNullOrWhiteSpace(mp.Player.Nickname) ? mp.Player.Nickname : $"{mp.Player.Name} {mp.Player.LastName}") : "Desconocido",
                Team = mp.Team
            }).ToList(),
            GroupMembers = groupMembers.Select(gm => new GroupMemberDetailsDto
            {
                PlayerId = gm.PlayerId,
                Name = gm.Player != null ? $"{gm.Player.Name} {gm.Player.LastName}" : "Desconocido",
                Nickname = gm.Player != null ? (!string.IsNullOrWhiteSpace(gm.Player.Nickname) ? gm.Player.Nickname : $"{gm.Player.Name} {gm.Player.LastName}") : "Desconocido",
                Score = gm.Score
            }).ToList()
        };
    }

    public async Task<bool> UpdateMatchPlayersAsync(int matchId, int userId, List<MatchPlayerUpdateDto> players, DateTime date)
    {
        var match = await _context.Matches
            .Include(m => m.Group)
            .Include(m => m.MatchPlayers)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return false;

        // Cualquier miembro del grupo puede editar el partido
        var isMember = await IsUserInGroupAsync(match, userId);
        if (!isMember) return false;

        // Actualizar fecha
        match.Date = date;

        // Actualizar jugadores
        _context.MatchPlayers.RemoveRange(match.MatchPlayers);

        var newPlayers = players.Select(p => new MatchPlayer()
        {
            MatchId = matchId,
            PlayerId = p.PlayerId,
            Team = p.Team
        }).ToList();
        
        _context.MatchPlayers.AddRange(newPlayers);
        

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> FinishMatchAsync(int matchId, int userId, FinishMatchRequestDto request)
    {
        int score1 = 0;
        int score2 = 0;

        if (request.Winner == "Empate")
        {
            score1 = request.TotalGoals / 2;
            score2 = request.TotalGoals / 2;
        }
        else if (request.Winner == "A")
        {
            score1 = (request.TotalGoals + request.GoalsAhead) / 2;
            score2 = request.TotalGoals - score1;
        }
        else if (request.Winner == "B")
        {
            score2 = (request.TotalGoals + request.GoalsAhead) / 2;
            score1 = request.TotalGoals - score2;
        }

        var scoreState = $"{score1}-{score2}";
        
        var match = await _context.Matches
            .Include(m => m.Group)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return false;

        // Cualquier miembro del grupo puede finalizar el partido
        var isMember = await IsUserInGroupAsync(match, userId);
        if (!isMember) return false;
        

        match.State = scoreState;
        await _context.SaveChangesAsync();
        return true;
    }

    private async Task<bool> IsUserInGroupAsync(Match match, int userId)
    {
        var isMember = await _context.GroupPlayers.AnyAsync(gp => gp.GroupId == match.GroupId && gp.PlayerId == userId)
                       || match.Group?.CreatorId == userId;
        
        return isMember;
    }
}
