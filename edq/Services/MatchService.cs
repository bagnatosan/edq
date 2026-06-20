using edq.Data;
using edq.DTO;
using edq.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

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
        var userGroupIds = await _context.Groups
            .Where(g => g.CreatorId == userId || g.GroupPlayers.Any(gp => gp.PlayerId == userId))
            .Select(g => g.Id)
            .ToListAsync();

        if (userGroupIds.Count == 0)
        {
            return new List<UserUpcomingMatchDto>();
        }

        // 2. Obtener todos los partidos de esos grupos que sean futuros y estén pendientes
        var upcomingMatches = await _context.Matches
            .Include(m => m.Group)
            .Include(m => m.MatchPlayers)
                .ThenInclude(mp => mp.Player)
            .Where(m => userGroupIds.Contains(m.GroupId) && m.Date > DateTime.UtcNow && m.State == "Pending")
            .OrderBy(m => m.Date)
            .ToListAsync();

        // 3. Mapear a DTO
        var result = upcomingMatches.Select(m =>
        {
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

            return new UserUpcomingMatchDto
            {
                MatchId = m.Id,
                GroupId = m.GroupId,
                GroupName = m.Group?.Name ?? "Grupo Desconocido",
                Date = m.Date,
                Team1 = team1,
                Team2 = team2
            };
        }).ToList();

        return result;
    }
}
