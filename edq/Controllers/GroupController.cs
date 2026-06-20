using edq.DTO;
using edq.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Threading.Tasks;

namespace edq.Controllers;

[Authorize]
public class GroupController : Controller
{
    private readonly IGroupService _groupService;

    public GroupController(IGroupService groupService)
    {
        _groupService = groupService;
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

        var (myGroups, otherGroups) = await _groupService.GetGroupsAsync(userId, search, skip, take);

        // Mapear los DTOs a la misma estructura JSON que espera el cliente javascript
        var myGroupsResult = myGroups.Select(g => new
        {
            id = g.Id,
            name = g.Name,
            creatorName = g.CreatorName,
            memberCount = g.MemberCount,
            isCreator = g.IsCreator,
            isMember = g.IsMember,
            requestStatus = g.RequestStatus
        }).ToList();

        var otherGroupsResult = otherGroups.Select(g => new
        {
            id = g.Id,
            name = g.Name,
            creatorName = g.CreatorName,
            memberCount = g.MemberCount,
            isCreator = g.IsCreator,
            isMember = g.IsMember,
            requestStatus = g.RequestStatus
        }).ToList();

        return Json(new
        {
            myGroups = myGroupsResult,
            otherGroups = otherGroupsResult
        });
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

        var result = await _groupService.RequestJoinGroupAsync(userId, groupId);

        return result switch
        {
            JoinRequestResult.GroupNotFound => NotFound("Grupo no encontrado."),
            JoinRequestResult.IsCreator => BadRequest("Eres el creador de este grupo."),
            JoinRequestResult.AlreadyMember => BadRequest("Ya eres miembro de este grupo."),
            JoinRequestResult.AlreadyRequested => Conflict("Ya has enviado una solicitud para este grupo."),
            JoinRequestResult.SuccessPending => Json(new { success = true, state = "Pending" }),
            JoinRequestResult.SuccessApproved => Json(new { success = true, state = "Approved" }),
            _ => BadRequest("Error al procesar la solicitud.")
        };
    }

    // GET: /Group/Dashboard
    [HttpGet]
    public async Task<IActionResult> Dashboard(int groupId)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var canAccess = await _groupService.CanAccessDashboardAsync(userId, groupId);
        if (!canAccess)
        {
            return Forbid();
        }

        ViewBag.GroupId = groupId;
        return View();
    }

    // GET: /Group/CreateMatch
    [HttpGet]
    public async Task<IActionResult> CreateMatch(int groupId)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        // Validar acceso: Solo el creador puede crear partidos
        var groupData = await _groupService.GetGroupDashboardDataAsync(userId, groupId);
        if (groupData == null || !groupData.IsCreator)
        {
            return Forbid();
        }

        ViewBag.GroupId = groupId;
        return View();
    }

    // GET: /Group/GetGroupDashboardData (AJAX endpoint)
    [HttpGet]
    public async Task<IActionResult> GetGroupDashboardData(int groupId)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var data = await _groupService.GetGroupDashboardDataAsync(userId, groupId);
        if (data == null)
        {
            return Forbid();
        }

        // Mapear al formato JSON que espera el cliente javascript
        return Json(new
        {
            groupId = data.GroupId,
            groupName = data.GroupName,
            isCreator = data.IsCreator,
            members = data.Members.Select(m => new
            {
                id = m.Id,
                name = m.Name,
                nickname = m.Nickname,
                photoUrl = m.PhotoUrl,
                initials = m.Initials,
                score = m.Score,
                winrate = m.Winrate
            }).ToList(),
            pendingRequests = data.PendingRequests?.Select(r => new
            {
                requestId = r.RequestId,
                playerId = r.PlayerId,
                name = r.Name,
                nickname = r.Nickname,
                photoUrl = r.PhotoUrl,
                initials = r.Initials
            }).ToList()
        });
    }

    // POST: /Group/AcceptRequest (AJAX endpoint)
    [HttpPost]
    public async Task<IActionResult> AcceptRequest(int requestId)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var success = await _groupService.AcceptRequestAsync(userId, requestId);
        if (!success)
        {
            return BadRequest("La solicitud no pudo ser procesada, ya fue procesada o no tienes permisos.");
        }

        return Json(new { success = true });
    }

    // POST: /Group/DeclineRequest (AJAX endpoint)
    [HttpPost]
    public async Task<IActionResult> DeclineRequest(int requestId)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var success = await _groupService.DeclineRequestAsync(userId, requestId);
        if (!success)
        {
            return BadRequest("La solicitud no pudo ser procesada, ya fue procesada o no tienes permisos.");
        }

        return Json(new { success = true });
    }

    // GET: /Group/AssignScores
    [HttpGet]
    public async Task<IActionResult> AssignScores(int groupId)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var groupData = await _groupService.GetGroupDashboardDataAsync(userId, groupId);
        if (groupData == null || !groupData.IsCreator)
        {
            return Forbid();
        }

        ViewBag.GroupId = groupId;
        return View();
    }

    // POST: /Group/UpdateScores (AJAX endpoint)
    [HttpPost]
    public async Task<IActionResult> UpdateScores(int groupId, [FromBody] System.Collections.Generic.List<MemberScoreUpdateDto> updates)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        if (updates == null || updates.Count == 0)
        {
            return BadRequest("No se recibieron puntajes para actualizar.");
        }

        var success = await _groupService.UpdateMemberScoresAsync(userId, groupId, updates);
        if (!success)
        {
            return BadRequest("No se pudieron actualizar los puntajes.");
        }

        return Json(new { success = true });
    }

    // POST: /Group/CreateTemporaryPlayer (AJAX endpoint)
    [HttpPost]
    public async Task<IActionResult> CreateTemporaryPlayer(int groupId, string name, string lastName, byte initialScore)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(lastName))
        {
            return BadRequest("El nombre y el apellido son obligatorios.");
        }

        var success = await _groupService.CreateTemporaryPlayerAsync(userId, groupId, name, lastName, initialScore);
        if (!success)
        {
            return BadRequest("No se pudo crear el jugador temporal.");
        }

        return Json(new { success = true });
    }

    // GET: /Group/MatchHistory
    [HttpGet]
    public async Task<IActionResult> MatchHistory(int groupId)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var canAccess = await _groupService.CanAccessDashboardAsync(userId, groupId);
        if (!canAccess)
        {
            return Forbid();
        }

        ViewBag.GroupId = groupId;
        return View();
    }

    // GET: /Group/GetMatchHistoryData (AJAX endpoint)
    [HttpGet]
    public async Task<IActionResult> GetMatchHistoryData(int groupId)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var data = await _groupService.GetMatchHistoryAsync(userId, groupId);
        if (data == null)
        {
            return Forbid();
        }

        return Json(data);
    }
}


