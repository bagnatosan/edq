using edq.DTO;
using edq.Hubs;
using edq.Models;
using edq.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace edq.Controllers;

[Authorize]
public class ChatController : Controller
{
    private readonly IChatService _chatService;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly IPushNotificationService _pushService;

    public ChatController(
        IChatService chatService,
        IHubContext<ChatHub> hubContext,
        IPushNotificationService pushService)
    {
        _chatService = chatService;
        _hubContext = hubContext;
        _pushService = pushService;
    }

    // GET: /Group/Chat
    [HttpGet]
    [Route("Group/Chat")]
    public async Task<IActionResult> Chat(int groupId = 0)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        if (groupId <= 0)
        {
            return View("~/Views/Group/ChatList.cshtml");
        }

        var belongs = await _chatService.CanAccessChatAsync(userId.Value, groupId);
        if (!belongs)
        {
            return Forbid();
        }

        var groupName = await _chatService.GetGroupNameAsync(groupId);
        if (groupName == null)
        {
            return RedirectToAction("Explore", "Group");
        }

        ViewBag.GroupId = groupId;
        ViewBag.GroupName = groupName;
        return View("~/Views/Group/Chat.cshtml");
    }

    // GET: /Chat/GetMessages (AJAX)
    [HttpGet]
    public async Task<IActionResult> GetMessages(int groupId, int skip = 0, int take = 30)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var belongs = await _chatService.CanAccessChatAsync(userId.Value, groupId);
        if (!belongs)
        {
            return Forbid();
        }

        var messages = await _chatService.GetMessagesAsync(groupId, skip, take);
        return Json(messages);
    }

    // POST: /Chat/CreatePoll (AJAX)
    [HttpPost]
    public async Task<IActionResult> CreatePoll([FromBody] CreatePollRequestDto request)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var belongs = await _chatService.CanAccessChatAsync(userId.Value, request.GroupId);
        if (!belongs)
        {
            return Forbid();
        }

        var pollDto = await _chatService.CreatePollAsync(userId.Value, request.GroupId, request.Question, request.Options, request.DurationMinutes, request.TargetDate);
        if (pollDto == null)
        {
            return BadRequest("No se pudo crear la encuesta.");
        }

        // Emitir vía SignalR
        await _hubContext.Clients.Group($"Group_{request.GroupId}").SendAsync("PollCreated", pollDto);

        // Enviar notificación Push en segundo plano
        _ = _pushService.SendNotificationToGroupAsync(
            request.GroupId,
            "📊 Nueva Encuesta",
            $"Se creó la encuesta: \"{request.Question}\"",
            $"/Group/Chat?groupId={request.GroupId}",
            userId.Value,
            NotificationType.Chat
        );

        return Json(pollDto);
    }

    // GET: /Chat/GetActivePolls (AJAX)
    [HttpGet]
    public async Task<IActionResult> GetActivePolls(int groupId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var belongs = await _chatService.CanAccessChatAsync(userId.Value, groupId);
        if (!belongs)
        {
            return Forbid();
        }

        var polls = await _chatService.GetActivePollsAsync(userId.Value, groupId);
        return Json(polls);
    }

    // POST: /Chat/Vote (AJAX)
    [HttpPost]
    public async Task<IActionResult> Vote([FromBody] VoteRequestDto request)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }
        
        
        var (success, groupId, updatedPollData) = await _chatService.VoteAsync(userId.Value, request.PollId, request.OptionId);
        if (!success)
        {
            return BadRequest("No se pudo registrar el voto en este momento.");
        }

        // Emitir a SignalR
        await _hubContext.Clients.Group($"Group_{groupId}").SendAsync("PollUpdated", updatedPollData);

        return Ok(new { success = true });
    }

    // GET: /Chat/GetLatestPollVoters (AJAX)
    [HttpGet]
    public async Task<IActionResult> GetLatestPollVoters(int groupId)
    {
        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var belongs = await _chatService.CanAccessChatAsync(userId.Value, groupId);
        if (!belongs)
        {
            return Forbid();
        }

        var voterIds = await _chatService.GetLatestPollVotersAsync(groupId);
        return Json(voterIds);
    }
    
    private int? GetUserId()
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(userIdString, out var userId) ? userId : null;
    }
}
