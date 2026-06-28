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
            return new List<UserUpcomingMatchDto>();

        // 2. Obtener todos los partidos de esos grupos que estén pendientes mediante proyección directa
        return await _context.Matches
            .Where(m => userGroupIds.Contains(m.GroupId) && m.State == "Pending")
            .OrderBy(m => m.Date)
            .Select(m => new UserUpcomingMatchDto()
            {
                MatchId = m.Id,
                GroupId = m.GroupId,
                GroupName = m.Group != null ? m.Group.Name : "Grupo Desconocido",
                Date = m.Date,

                Team1 = m.MatchPlayers.Where(mp => mp.Player != null && mp.Team == 1)
                    .Select(mp => mp.Player != null
                        ? (!string.IsNullOrWhiteSpace(mp.Player.Nickname)
                            ? mp.Player.Nickname
                            : $"{mp.Player.Name} {mp.Player.LastName}")
                        : "Desconocido")
                    .ToList(),
                Team2 = m.MatchPlayers.Where(mp => mp.Player != null && mp.Team == 2)
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
        // 1. Validar acceso de manera eficiente en una sola consulta ligera
        var matchAccess = await _context.Matches.AsNoTracking()
            .Where(m => m.Id == matchId)
            .Select(m => new
            {
                m.GroupId,
                GroupCreatorId = m.Group != null ? m.Group.CreatorId : 0,
                IsMember = _context.GroupPlayers.Any(gp => gp.GroupId == m.GroupId && gp.PlayerId == userId)
            })
            .FirstOrDefaultAsync();

        if (matchAccess == null)
            return null;

        var isUserAuthorized = matchAccess.IsMember || matchAccess.GroupCreatorId == userId;
        if (!isUserAuthorized)
            return null;

        // 2. Traer el partido proyectado directamente desde SQL
        var matchDetails = await _context.Matches.AsNoTracking()
            .Where(m => m.Id == matchId)
            .Select(m => new
            {
                MatchId = m.Id,
                GroupId = m.GroupId,
                GroupName = m.Group != null ? m.Group.Name : "Grupo Desconocido",
                Date = m.Date,
                State = m.State,
                MatchPlayers = m.MatchPlayers.Select(mp => new MatchPlayerDetailsDto
                {
                    PlayerId = mp.PlayerId,
                    Name = mp.Player != null ? mp.Player.Name + " " + mp.Player.LastName : "Desconocido",
                    Nickname = mp.Player != null 
                        ? (!string.IsNullOrWhiteSpace(mp.Player.Nickname) ? mp.Player.Nickname : mp.Player.Name + " " + mp.Player.LastName) 
                        : "Desconocido",
                    Team = mp.Team
                }).ToList()
            })
            .FirstOrDefaultAsync();

        if (matchDetails == null)
            return null;

        // 3. Traer miembros del grupo proyectados
        var groupMembers = await _context.GroupPlayers.AsNoTracking()
            .Where(gp => gp.GroupId == matchDetails.GroupId)
            .Select(gm => new GroupMemberDetailsDto
            {
                PlayerId = gm.PlayerId,
                Name = gm.Player != null ? gm.Player.Name + " " + gm.Player.LastName : "Desconocido",
                Nickname = gm.Player != null 
                    ? (!string.IsNullOrWhiteSpace(gm.Player.Nickname) ? gm.Player.Nickname : gm.Player.Name + " " + gm.Player.LastName) 
                    : "Desconocido",
                Score = gm.Score
            })
            .ToListAsync();

        return new MatchDetailsDto
        {
            MatchId = matchDetails.MatchId,
            GroupId = matchDetails.GroupId,
            GroupName = matchDetails.GroupName,
            Date = matchDetails.Date,
            State = matchDetails.State,
            IsCreator = true,
            MatchPlayers = matchDetails.MatchPlayers,
            GroupMembers = groupMembers
        };
    }

    public async Task<bool> UpdateMatchPlayersAsync(int matchId, int userId, List<MatchPlayerUpdateDto> players, DateTime date)
    {
        // 1. Obtener la info mínima del partido y verificar acceso en una sola consulta ligera
        var matchInfo = await _context.Matches.AsNoTracking()
            .Where(m => m.Id == matchId)
            .Select(m => new
            {
                m.GroupId,
                GroupCreatorId = m.Group != null ? m.Group.CreatorId : 0,
                IsMember = _context.GroupPlayers.Any(gp => gp.GroupId == m.GroupId && gp.PlayerId == userId)
            })
            .FirstOrDefaultAsync();

        if (matchInfo == null)
            return false;

        var isUserAuthorized = matchInfo.IsMember || matchInfo.GroupCreatorId == userId;
        if (!isUserAuthorized)
            return false;

        // 2. Cargar el partido y sus MatchPlayers para modificar (sin incluir Group)
        var match = await _context.Matches
            .Include(m => m.MatchPlayers)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null)
            return false;

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

        // 1. Obtener la info mínima del partido y verificar acceso en una sola consulta ligera
        var matchInfo = await _context.Matches.AsNoTracking()
            .Where(m => m.Id == matchId)
            .Select(m => new
            {
                m.GroupId,
                GroupCreatorId = m.Group != null ? m.Group.CreatorId : 0,
                IsMember = _context.GroupPlayers.Any(gp => gp.GroupId == m.GroupId && gp.PlayerId == userId)
            })
            .FirstOrDefaultAsync();

        if (matchInfo == null)
            return false;

        var isUserAuthorized = matchInfo.IsMember || matchInfo.GroupCreatorId == userId;
        if (!isUserAuthorized)
            return false;
        
        // 2. Cargar el partido sin ningún Include para actualizar el estado
        var match = await _context.Matches.FirstOrDefaultAsync(m => m.Id == matchId);
        if (match == null)
            return false;

        match.State = scoreState;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteMatchAsync(int matchId, int userId)
    {
        // 1. Obtener la info mínima del partido y verificar acceso
        var matchInfo = await _context.Matches.AsNoTracking()
            .Where(m => m.Id == matchId)
            .Select(m => new
            {
                m.GroupId,
                GroupCreatorId = m.Group != null ? m.Group.CreatorId : 0,
                IsMember = _context.GroupPlayers.Any(gp => gp.GroupId == m.GroupId && gp.PlayerId == userId)
            })
            .FirstOrDefaultAsync();

        if (matchInfo == null)
            return false;

        var isUserAuthorized = matchInfo.IsMember || matchInfo.GroupCreatorId == userId;
        if (!isUserAuthorized)
            return false;

        // 2. Borrar primero las convocatorias asociadas por la restricción de FK
        var matchPlayers = await _context.MatchPlayers
            .Where(mp => mp.MatchId == matchId)
            .ToListAsync();
        _context.MatchPlayers.RemoveRange(matchPlayers);

        // 3. Borrar el partido
        var match = await _context.Matches.FindAsync(matchId);
        if (match != null)
        {
            _context.Matches.Remove(match);
        }

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
