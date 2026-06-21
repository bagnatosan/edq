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

    public async Task<MatchDetailsDto?> GetMatchDetailsAsync(int matchId, int userId)
    {
        var match = await _context.Matches
            .Include(m => m.Group)
            .Include(m => m.MatchPlayers)
                .ThenInclude(mp => mp.Player)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return null;

        // Validar acceso: el usuario debe ser creador o miembro del grupo
        var isMember = await _context.GroupPlayers.AnyAsync(gp => gp.GroupId == match.GroupId && gp.PlayerId == userId)
                       || match.Group?.CreatorId == userId;

        if (!isMember) return null;

        var isCreator = match.Group?.CreatorId == userId;

        // Obtener todos los miembros del grupo para permitir agregar/sacar
        var groupMembers = await _context.GroupPlayers
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
                Nickname = mp.Player != null ? (string.IsNullOrWhiteSpace(mp.Player.Nickname) ? mp.Player.Name : mp.Player.Nickname) : "Desconocido",
                Team = mp.Team
            }).ToList(),
            GroupMembers = groupMembers.Select(gm => new GroupMemberDetailsDto
            {
                PlayerId = gm.PlayerId,
                Name = gm.Player != null ? $"{gm.Player.Name} {gm.Player.LastName}" : "Desconocido",
                Nickname = gm.Player != null ? (string.IsNullOrWhiteSpace(gm.Player.Nickname) ? gm.Player.Name : gm.Player.Nickname) : "Desconocido",
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

        // Solo el creador del grupo puede editar el partido
        if (match.Group?.CreatorId != userId) return false;

        // Actualizar fecha
        match.Date = date;

        // Actualizar jugadores
        _context.MatchPlayers.RemoveRange(match.MatchPlayers);

        foreach (var p in players)
        {
            _context.MatchPlayers.Add(new MatchPlayer
            {
                MatchId = matchId,
                PlayerId = p.PlayerId,
                Team = p.Team
            });
        }

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> FinishMatchAsync(int matchId, int userId, string scoreState)
    {
        var match = await _context.Matches
            .Include(m => m.Group)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return false;

        // Solo el creador del grupo puede finalizar el partido
        if (match.Group?.CreatorId != userId) return false;

        match.State = scoreState;
        await _context.SaveChangesAsync();
        return true;
    }
}
