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
            return JoinRequestResult.Success;
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
        var members = await _context.GroupPlayers
            .Include(gp => gp.Player)
            .Where(gp => gp.GroupId == groupId)
            .OrderBy(gp => gp.Player!.Name)
            .Select(gp => new GroupMemberDto
            {
                Id = gp.PlayerId,
                Name = $"{gp.Player!.Name} {gp.Player.LastName}",
                Nickname = gp.Player.Nickname ?? gp.Player.Name,
                PhotoUrl = gp.Player.PhotoUrl,
                Initials = gp.Player.Initials,
                Score = gp.Score
            })
            .ToListAsync();

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

        return new GroupDashboardDto
        {
            GroupId = group.Id,
            GroupName = group.Name,
            IsCreator = isCreator,
            Members = members,
            PendingRequests = pendingRequests
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
}
