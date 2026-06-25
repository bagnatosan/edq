using edq.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace edq.Controllers;

[Authorize]
[Route("Push/[action]")]
public class PushSubscriptionController : Controller
{
    private readonly IPushNotificationService _pushService;

    public PushSubscriptionController(IPushNotificationService pushService)
    {
        _pushService = pushService;
    }

    // GET: /Push/PublicKey
    [HttpGet]
    [AllowAnonymous]
    public IActionResult PublicKey()
    {
        var key = _pushService.GetVapidPublicKey();
        return Content(key, "text/plain");
    }

    // POST: /Push/Subscribe
    [HttpPost]
    public async Task<IActionResult> Subscribe([FromBody] PushSubscriptionRequestDto request)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
            return Unauthorized();
        

        var success = await _pushService.SubscribePlayerAsync(userId, request.Endpoint, request.P256Dh, request.Auth);
        if (!success)
            return BadRequest("Suscripción inválida.");
        

        return Ok(new { success = true });
    }

    // POST: /Push/Unsubscribe
    [HttpPost]
    public async Task<IActionResult> Unsubscribe([FromBody] UnsubscribeRequestDto request)
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
            return Unauthorized();
        

        await _pushService.UnsubscribePlayerAsync(userId, request.Endpoint);
        return Ok(new { success = true });
    }
}

public class PushSubscriptionRequestDto
{
    public string Endpoint { get; set; } = string.Empty;
    public string P256Dh { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
}

public class UnsubscribeRequestDto
{
    public string Endpoint { get; set; } = string.Empty;
}
