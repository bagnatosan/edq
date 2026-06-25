using edq.DTO;
using edq.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace edq.Controllers;

[Authorize]
public class GroupController : Controller
{
    private readonly IGroupService _groupService;
    private readonly IMatchmakingService _matchmakingService;
    private readonly IPushNotificationService _pushService;

    public GroupController(IGroupService groupService, IMatchmakingService matchmakingService, IPushNotificationService pushService)
    {
        _groupService = groupService;
        _matchmakingService = matchmakingService;
        _pushService = pushService;
    }

    // GET: /Group/Explore
    [HttpGet]
    public IActionResult Explore()
    {
        return View();
    }

    // GET: /Group/Create
    [HttpGet]
    public IActionResult Create()
    {
        return View();
    }

    // POST: /Group/CreateGroup (AJAX endpoint)
    [HttpPost]
    public async Task<IActionResult> CreateGroup(string name)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(name))
            return BadRequest("El nombre del grupo no puede estar vacío.");

        var groupId = await _groupService.CreateGroupAsync(userId.Value, name.Trim());
        return Ok(new { success = true, groupId });
    }

    // GET: /Group/GetGroups (AJAX endpoint)
    [HttpGet]
    public async Task<IActionResult> GetGroups(string? search, int skip = 0, int take = 15)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var (myGroups, otherGroups) = await _groupService.GetGroupsAsync(userId.Value, search, skip, take);

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
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var result = await _groupService.RequestJoinGroupAsync(userId.Value, groupId);

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
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var canAccess = await _groupService.CanAccessDashboardAsync(userId.Value, groupId);
        
        if (!canAccess)  return Forbid();

        ViewBag.GroupId = groupId;
        return View();
    }

    // GET: /Group/CreateMatch
    [HttpGet]
    public async Task<IActionResult> CreateMatch(int groupId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        // Validar acceso: Cualquier miembro del grupo puede crear partidos
        var canAccess = await _groupService.CanAccessDashboardAsync(userId.Value, groupId);
        
        if (!canAccess) return Forbid();
        

        ViewBag.GroupId = groupId;
        return View();
    }

    // POST: /Group/BalanceAndCreateMatch
    [HttpPost]
    public async Task<IActionResult> BalanceAndCreateMatch([FromBody] BalanceMatchRequestDto request)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        // Validar acceso: Cualquier miembro del grupo puede crear partidos
        var canAccess = await _groupService.CanAccessDashboardAsync(userId.Value, request.GroupId);
        if (!canAccess)
            return Forbid();

        if (request.PlayerIds == null || request.PlayerIds.Count < 2)
            return BadRequest("Debes seleccionar al menos dos jugadores.");

        var teamsBalanced = await _matchmakingService.BalanceTeamsAsync(request.PlayerIds, request.GroupId);
        var success = await _matchmakingService.CreateMatchAsync(request.GroupId, request.Date, request.PlayerIds, teamsBalanced);

        if (!success)
            return BadRequest("No se pudo crear el partido balanceado.");

        _ = _pushService.SendMatchCreationNotificationAsync(userId.Value, request.GroupId, request.PlayerIds, request.Date);

        return Ok(new { success = true });
    }

    // GET: /Group/GetGroupDashboardData (AJAX endpoint)
    [HttpGet]
    public async Task<IActionResult> GetGroupDashboardData(int groupId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }
        

        var data = await _groupService.GetGroupDashboardDataAsync(userId.Value, groupId);
        if (data == null) return Forbid();
        

        // Mapear al formato JSON que espera el cliente javascript
        return Json(new
        {
            groupId = data.GroupId,
            groupName = data.GroupName,
            isCreator = data.IsCreator,
            creatorId = userId.Value,
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
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var success = await _groupService.AcceptRequestAsync(userId.Value, requestId);
        if (!success)
            return BadRequest("La solicitud no pudo ser procesada, ya fue procesada o no tienes permisos.");

        return Json(new { success = true });
    }

    // POST: /Group/DeclineRequest (AJAX endpoint)
    [HttpPost]
    public async Task<IActionResult> DeclineRequest(int requestId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var success = await _groupService.DeclineRequestAsync(userId.Value, requestId);
        if (!success)
            return BadRequest("La solicitud no pudo ser procesada, ya fue procesada o no tienes permisos.");
        

        return Json(new { success = true });
    }

    // GET: /Group/AssignScores
    [HttpGet]
    public async Task<IActionResult> AssignScores(int groupId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var groupData = await _groupService.GetGroupDashboardDataAsync(userId.Value, groupId);
        if (groupData == null || !groupData.IsCreator)
            return Forbid();
        

        ViewBag.GroupId = groupId;
        return View();
    }

    // POST: /Group/UpdateScores (AJAX endpoint)
    [HttpPost]
    public async Task<IActionResult> UpdateScores(int groupId, [FromBody] List<MemberScoreUpdateDto>? updates)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        if (updates == null || updates.Count == 0) 
            return BadRequest("No se recibieron puntajes para actualizar.");
        

        var success = await _groupService.UpdateMemberScoresAsync(userId.Value, groupId, updates);
        if (!success)
            return BadRequest("No se pudieron actualizar los puntajes.");

        return Json(new { success = true });
    }

    // POST: /Group/CreateTemporaryPlayer (AJAX endpoint)
    [HttpPost]
    public async Task<IActionResult> CreateTemporaryPlayer(int groupId, string name, string lastName, byte initialScore)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(lastName))
            return BadRequest("El nombre y el apellido son obligatorios.");
        

        var success = await _groupService.CreateTemporaryPlayerAsync(userId.Value, groupId, name, lastName, initialScore);
        if (!success)
            return BadRequest("No se pudo crear el jugador temporal.");

        return Json(new { success = true });
    }

    // GET: /Group/MatchHistory
    [HttpGet]
    public async Task<IActionResult> MatchHistory(int groupId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var canAccess = await _groupService.CanAccessDashboardAsync(userId.Value, groupId);
        if (!canAccess)
            return Forbid();

        ViewBag.GroupId = groupId;
        return View();
    }

    // GET: /Group/GetMatchHistoryData (AJAX endpoint)
    [HttpGet]
    public async Task<IActionResult> GetMatchHistoryData(int groupId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var data = await _groupService.GetMatchHistoryAsync(userId.Value, groupId);
        if (data == null)
            return Forbid();

        var isCreator = await _groupService.IsGroupCreatorAsync(userId.Value, groupId);
        return Json(new { isCreator, matches = data });
    }

    // GET: /Group/AdminPanel
    [HttpGet]
    public async Task<IActionResult> AdminPanel(int groupId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var groupData = await _groupService.GetGroupDashboardDataAsync(userId.Value, groupId);
        if (groupData == null || !groupData.IsCreator)
            return Forbid();

        ViewBag.GroupId = groupId;
        return View();
    }

    // GET: /Group/CreateTempPlayer
    [HttpGet]
    public async Task<IActionResult> CreateTempPlayer(int groupId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var groupData = await _groupService.GetGroupDashboardDataAsync(userId.Value, groupId);
        if (groupData == null || !groupData.IsCreator)
            return Forbid();

        ViewBag.GroupId = groupId;
        return View();
    }

    // GET: /Group/GroupSettings
    [HttpGet]
    public async Task<IActionResult> GroupSettings(int groupId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var groupData = await _groupService.GetGroupDashboardDataAsync(userId.Value, groupId);
        if (groupData == null || !groupData.IsCreator)
            return Forbid();

        ViewBag.GroupId = groupId;
        return View();
    }

    // POST: /Group/UpdateGroupName (AJAX endpoint)
    [HttpPost]
    public async Task<IActionResult> UpdateGroupName(int groupId, string name)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(name))
            return BadRequest("El nombre del grupo no puede estar vacío.");

        var success = await _groupService.UpdateGroupNameAsync(userId.Value, groupId, name);
        if (!success)
            return BadRequest("No se pudo actualizar el nombre del grupo.");

        return Json(new { success = true });
    }

    // GET: /Group/RemoveMembers
    [HttpGet]
    public async Task<IActionResult> RemoveMembers(int groupId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var groupData = await _groupService.GetGroupDashboardDataAsync(userId.Value, groupId);
        if (groupData == null || !groupData.IsCreator)
            return Forbid();

        ViewBag.GroupId = groupId;
        return View();
    }

    // POST: /Group/RemoveMember (AJAX endpoint)
    [HttpPost]
    public async Task<IActionResult> RemoveMember(int groupId, int playerId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var success = await _groupService.RemoveMemberAsync(userId.Value, groupId, playerId);
        if (!success)
            return BadRequest("No se pudo eliminar al jugador del grupo o no tienes permisos.");

        return Json(new { success = true });
    }
    
    private int? GetUserId()
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(userIdString, out var userId) ? userId : null;
    }
}