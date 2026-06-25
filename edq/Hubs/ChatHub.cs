using edq.Data;
using edq.Models;
using edq.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace edq.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly ApplicationDbContext _context;
    private readonly IPushNotificationService _pushService;

    public ChatHub(ApplicationDbContext context, IPushNotificationService pushService)
    {
        _context = context;
        _pushService = pushService;
    }

    public async Task JoinGroupChat(int groupId)
    {
        var userIdString = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            throw new HubException("No autorizado");
        }

        // Validar si el usuario pertenece al grupo
        var isMember = await _context.GroupPlayers.AnyAsync(gp => gp.GroupId == groupId && gp.PlayerId == userId)
                       || await _context.Groups.AnyAsync(g => g.Id == groupId && g.CreatorId == userId);

        if (!isMember)
        {
            throw new HubException("No eres miembro de este grupo.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"Group_{groupId}");
    }

    public async Task SendMessage(int groupId, string messageText)
    {
        var userIdString = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdString, out var userId))
        {
            throw new HubException("No autorizado");
        }

        if (string.IsNullOrWhiteSpace(messageText))
            return;

        if (messageText.Length > 4096)
            throw new HubException("El mensaje no puede superar los 4096 caracteres.");

        var player = await _context.Players.FindAsync(userId);
        if (player == null)
        {
            throw new HubException("Usuario no encontrado.");
        }

        var msg = new ChatMessage
        {
            GroupId = groupId,
            SenderId = userId,
            MessageText = messageText.Trim(),
            SentAt = DateTime.UtcNow
        };

        _context.ChatMessages.Add(msg);
        await _context.SaveChangesAsync();

        var senderName = !string.IsNullOrWhiteSpace(player.Nickname) ? player.Nickname : $"{player.Name} {player.LastName}";
        var senderInitials = player.Initials;

        // Broadcast a todos en la sala del grupo
        await Clients.Group($"Group_{groupId}").SendAsync("ReceiveMessage", new
        {
            id = msg.Id,
            senderId = userId,
            senderName = senderName,
            senderInitials = senderInitials,
            photoUrl = player.PhotoUrl,
            messageText = msg.MessageText,
            sentAt = msg.SentAt.ToString("o")
        });

        // Enviar notificación Push en segundo plano
        _ = _pushService.SendNotificationToGroupAsync(
            groupId,
            "💬",
            $"{senderName}: {msg.MessageText}",
            $"/Group/Chat?groupId={groupId}",
            userId,
            NotificationType.Chat
        );
    }
}
