using edq.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Threading.Tasks;

namespace edq.Controllers;

[Authorize]
public class MatchController : Controller
{
    private readonly IMatchService _matchService;

    public MatchController(IMatchService matchService)
    {
        _matchService = matchService;
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
}
