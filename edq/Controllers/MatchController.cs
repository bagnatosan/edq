using edq.Services;
using edq.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace edq.Controllers;

[Authorize]
public class MatchController : Controller
{
    private readonly IMatchService _matchService;
    private readonly IMatchmakingService _matchmakingService;
    private readonly IPushNotificationService _pushService;

    public MatchController(IMatchService matchService, IMatchmakingService matchmakingService, IPushNotificationService pushService)
    {
        _matchService = matchService;
        _matchmakingService = matchmakingService;
        _pushService = pushService;
    }

    // GET: /Match/Upcoming
    [HttpGet]
    public IActionResult Upcoming()
    {
        return View();
    }
    
    
    // GET: /Match/GetUpcomingMatches (AJAX)
    [HttpGet]
    public async Task<IActionResult> GetUpcomingMatches()
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var matches = await _matchService.GetUpcomingMatchesForUserAsync(userId.Value);
        return Json(matches);
    }

    // GET: /Match/Edit
    [HttpGet]
    public async Task<IActionResult> Edit(int matchId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var details = await _matchService.GetMatchDetailsAsync(matchId, userId.Value);
        if (details == null)
        {
            return Forbid();
        }

        return View(details);
    }

    // GET: /Match/GetMatchDetails (AJAX)
    [HttpGet]
    public async Task<IActionResult> GetMatchDetails(int matchId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var details = await _matchService.GetMatchDetailsAsync(matchId, userId.Value);
        if (details == null)
        {
            return Forbid();
        }

        return Json(details);
    }

    // POST: /Match/UpdateMatch (AJAX)
    [HttpPost]
    public async Task<IActionResult> UpdateMatch([FromBody] UpdateMatchRequestDto request)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var success = await _matchService.UpdateMatchPlayersAsync(request.MatchId, userId.Value, request.Players, request.Date);
        if (!success)
        {
            return BadRequest("No se pudo actualizar el partido.");
        }

        await _pushService.SendMatchModificationNotificationAsync(userId.Value, request.MatchId);

        return Ok(new { success = true });
    }

    // POST: /Match/FinishMatch (AJAX)
    [HttpPost]
    public async Task<IActionResult> FinishMatch([FromBody] FinishMatchRequestDto request)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var success = await _matchService.FinishMatchAsync(request.MatchId, userId.Value, request);
        
        if (!success)
        {
            return BadRequest("No se pudo finalizar el partido.");
        }

        return Ok(new { success = true });
    }
    
    // POST: /Match/DeleteMatch (AJAX)
    [HttpPost]
    public async Task<IActionResult> DeleteMatch(int matchId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var success = await _matchService.DeleteMatchAsync(matchId, userId.Value);
        if (!success)
        {
            return BadRequest("No se pudo eliminar el partido o no tienes permisos.");
        }

        return Ok(new { success = true });
    }
    

    // POST: /Match/BalancePlayers (AJAX)
    [HttpPost]
    public async Task<IActionResult> BalancePlayers([FromBody] BalanceMatchRequestDto request)
    {
        if (request.PlayerIds == null || request.PlayerIds.Count < 2)
        {
            return BadRequest("Debes seleccionar al menos dos jugadores.");
        }

        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var teamsBalanced = await _matchmakingService.BalanceTeamsAsync(request.PlayerIds, request.GroupId);
        return Ok(teamsBalanced);
    }

    private int? GetUserId()
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(userIdString, out var userId) ? userId : null;
    }
}
