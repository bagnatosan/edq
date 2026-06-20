using edq.Data;
using edq.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace edq.Controllers;

[Authorize]
public class GroupController : Controller
{
    private readonly ApplicationDbContext _context;

    public GroupController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: /Group/Explore
    [HttpGet]
    public IActionResult Explore()
    {
        return View();
    }

    // GET: /Group/GetGroups (AJAX endpoint)
    [HttpGet]
    public async Task<IActionResult> GetGroups(string? search, int skip = 0, int take = 15)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var query = _context.Groups
            .Include(g => g.Creator)
            .Include(g => g.GroupPlayers)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.Trim().ToLower();
            query = query.Where(g => g.Name.ToLower().Contains(searchLower));
        }

        var groups = await query
            .OrderBy(g => g.Name)
            .Skip(skip)
            .Take(take)
            .ToListAsync();

        var groupIds = groups.Select(g => g.Id).ToList();

        // Get user requests for these groups
        var userRequests = await _context.Requests
            .Where(r => r.PlayerId == userId && groupIds.Contains(r.GroupId))
            .ToDictionaryAsync(r => r.GroupId, r => r.State);

        // Get user memberships for these groups
        var userMemberships = await _context.GroupPlayers
            .Where(gp => gp.PlayerId == userId && groupIds.Contains(gp.GroupId))
            .Select(gp => gp.GroupId)
            .ToListAsync();

        var result = groups.Select(g => new
        {
            id = g.Id,
            name = g.Name,
            creatorName = g.Creator != null ? (g.Creator.Nickname ?? $"{g.Creator.Name} {g.Creator.LastName}") : "Desconocido",
            memberCount = g.GroupPlayers.Count,
            isCreator = g.CreatorId == userId,
            isMember = userMemberships.Contains(g.Id),
            requestStatus = userRequests.TryGetValue(g.Id, out var status) ? status : null
        });

        return Json(result);
    }

    // POST: /Group/JoinRequest (AJAX endpoint)
    [HttpPost]
    public async Task<IActionResult> JoinRequest(int groupId)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var group = await _context.Groups.FindAsync(groupId);
        if (group == null)
        {
            return NotFound("Grupo no encontrado.");
        }

        // Check if creator
        if (group.CreatorId == userId)
        {
            return BadRequest("Eres el creador de este grupo.");
        }

        // Check if member
        var isMember = await _context.GroupPlayers.AnyAsync(gp => gp.GroupId == groupId && gp.PlayerId == userId);
        if (isMember)
        {
            return BadRequest("Ya eres miembro de este grupo.");
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
            return Json(new { success = true, state = "Pending" });
        }
        catch (DbUpdateException)
        {
            return Conflict("Ya has enviado una solicitud para este grupo.");
        }
    }
}
