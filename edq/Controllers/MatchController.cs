using edq.Services;
using edq.DTO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Threading.Tasks;
using System;

namespace edq.Controllers;

[Authorize]
public class MatchController : Controller
{
    private readonly IMatchService _matchService;
    private readonly IMatchmakingService _matchmakingService;

    public MatchController(IMatchService matchService, IMatchmakingService matchmakingService)
    {
        _matchService = matchService;
        _matchmakingService = matchmakingService;
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
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var matches = await _matchService.GetUpcomingMatchesForUserAsync(userId);
        return Json(matches);
    }

    // GET: /Match/Edit
    [HttpGet]
    public async Task<IActionResult> Edit(int matchId)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var details = await _matchService.GetMatchDetailsAsync(matchId, userId);
        if (details == null)
        {
            return Forbid();
        }

        ViewBag.MatchId = matchId;
        ViewBag.GroupId = details.GroupId;
        ViewBag.GroupName = details.GroupName;
        ViewBag.IsCreator = details.IsCreator;
        return View(details);
    }

    // GET: /Match/GetMatchDetails (AJAX)
    [HttpGet]
    public async Task<IActionResult> GetMatchDetails(int matchId)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var details = await _matchService.GetMatchDetailsAsync(matchId, userId);
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
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var success = await _matchService.UpdateMatchPlayersAsync(request.MatchId, userId, request.Players, request.Date);
        if (!success)
        {
            return BadRequest("No se pudo actualizar el partido.");
        }

        return Ok(new { success = true });
    }

    // POST: /Match/FinishMatch (AJAX)
    [HttpPost]
    public async Task<IActionResult> FinishMatch([FromBody] FinishMatchRequestDto request)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

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

        var success = await _matchService.FinishMatchAsync(request.MatchId, userId, scoreState);
        if (!success)
        {
            return BadRequest("No se pudo finalizar el partido.");
        }

        return Ok(new { success = true });
    }

    // POST: /Match/BalancePlayers (AJAX)
    [HttpPost]
    public async Task<IActionResult> BalancePlayers([FromBody] BalanceMatchRequestDto request)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var teamsBalanced = await _matchmakingService.BalanceTeamsAsync(request.PlayerIds, request.GroupId);
        return Ok(teamsBalanced);
    }
}
