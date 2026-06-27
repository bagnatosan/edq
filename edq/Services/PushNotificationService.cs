using edq.Data;
using edq.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using WebPush;

namespace edq.Services;

public class PushNotificationService : IPushNotificationService
{
    private readonly ApplicationDbContext _context;
    private readonly string _publicKey;
    private readonly string _privateKey;
    private readonly string _subject = "mailto:admin@edq.local";

    public PushNotificationService(ApplicationDbContext context)
    {
        _context = context;
    
        // Inicializar con valores por defecto para evitar advertencias de nulidad del compilador
        _publicKey = "";
        _privateKey = "";

        string directory = Path.Combine(AppContext.BaseDirectory, "wwwroot", "images", "profiles");
        if (!Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }
        string path = Path.Combine(directory, "vapid.json");
        bool keysLoaded = false;

        // 1. Intentar leer el archivo si existe
        if (File.Exists(path))
        {
            try
            {
                var keys = JsonSerializer.Deserialize<VapidKeysJson>(File.ReadAllText(path));
                _publicKey = keys?.PublicKey ?? "";
                _privateKey = keys?.PrivateKey ?? "";
            
                // Marcar como cargado si las llaves no están vacías
                if (!string.IsNullOrEmpty(_publicKey) && !string.IsNullOrEmpty(_privateKey))
                {
                    keysLoaded = true;
                }
            }
            catch
            {
                // Si la lectura falla, keysLoaded sigue en false y se regenerarán abajo
            }
        }

        // 2. Si las llaves no se cargaron correctamente, generar unas nuevas
        if (!keysLoaded)
        {
            var generated = VapidHelper.GenerateVapidKeys();
            _publicKey = generated.PublicKey;
            _privateKey = generated.PrivateKey;
        
            File.WriteAllText(path, JsonSerializer.Serialize(new VapidKeysJson 
            { 
                PublicKey = _publicKey, 
                PrivateKey = _privateKey 
            }));
        }
    }

    public string GetVapidPublicKey()
    {
        return _publicKey;
    }

    public async Task SendNotificationAsync(PushSubscriptionEntity subscription, string title, string body, string url)
    {
        var pushSubscription = new PushSubscription(subscription.Endpoint, subscription.P256dh, subscription.Auth);
        var vapidDetails = new VapidDetails(_subject, _publicKey, _privateKey);
        var webPushClient = new WebPushClient();

        var payload = JsonSerializer.Serialize(new
        {
            title,
            body,
            url
        });

        try
        {
            await webPushClient.SendNotificationAsync(pushSubscription, payload, vapidDetails);
        }
        catch (WebPushException ex)
        {
            Console.WriteLine($"[ERROR] SendNotificationAsync WebPushException: StatusCode={ex.StatusCode}, Message={ex.Message}");
            // Si el endpoint ya no existe (410 Gone o 404), remover la suscripción
            if (ex.StatusCode == System.Net.HttpStatusCode.Gone || ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                // Crear un DbContext temporal o usar el inyectado si sigue vivo.
                // Como SendNotificationAsync se ejecuta en paralelo y puede durar más que la petición original,
                // removemos de forma segura.
                try
                {
                    _context.PushSubscriptions.Remove(subscription);
                    await _context.SaveChangesAsync();
                }
                catch (Exception dbEx)
                {
                    Console.WriteLine($"[ERROR] Failed to remove stale subscription: {dbEx.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] SendNotificationAsync general Exception: {ex.Message}");
        }
    }

    public async Task SendNotificationToGroupAsync(int groupId, string title, string body, string url, int excludePlayerId = 0, NotificationType type = NotificationType.Default)
    {
        var memberIds = await _context.GroupPlayers.AsNoTracking()
            .Where(gp => gp.GroupId == groupId)
            .Select(gp => gp.PlayerId)
            .ToListAsync();

        var group = await _context.Groups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == groupId);
        if (group != null && !memberIds.Contains(group.CreatorId))
        {
            memberIds.Add(group.CreatorId);
        }

        if (excludePlayerId > 0)
        {
            memberIds.Remove(excludePlayerId);
        }

        if (memberIds.Count == 0) return;

        List<int> filteredMemberIds;
        switch (type)
        {
            case NotificationType.MatchCreation:
                filteredMemberIds = await _context.Players.AsNoTracking()
                    .Where(p => memberIds.Contains(p.Id) && p.NotifyMatchCreation)
                    .Select(p => p.Id)
                    .ToListAsync();
                break;
            case NotificationType.MatchModification:
                filteredMemberIds = await _context.Players.AsNoTracking()
                    .Where(p => memberIds.Contains(p.Id) && p.NotifyMatchModification)
                    .Select(p => p.Id)
                    .ToListAsync();
                break;
            case NotificationType.Chat:
                filteredMemberIds = await _context.Players.AsNoTracking()
                    .Where(p => memberIds.Contains(p.Id) && p.NotifyChat)
                    .Select(p => p.Id)
                    .ToListAsync();
                break;
            default:
                filteredMemberIds = memberIds;
                break;
        }

        if (filteredMemberIds.Count == 0) return;

        var subscriptions = await _context.PushSubscriptions.AsNoTracking()
            .Where(s => filteredMemberIds.Contains(s.PlayerId))
            .ToListAsync();

        var groupName = group?.Name ?? "Grupo";
        var finalTitle = $"[{groupName}] {title}";
        var finalBody = body.Replace("{groupName}", groupName);

        foreach (var sub in subscriptions)
        {
            _ = SendNotificationAsync(sub, finalTitle, finalBody, url);
        }
    }

    public async Task SendMatchCreationNotificationAsync(int creatorId, int groupId, List<int> chosenPlayerIds, DateTime date)
    {
        var creator = await _context.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Id == creatorId);
        var creatorName = creator != null ? (!string.IsNullOrWhiteSpace(creator.Nickname) ? creator.Nickname : $"{creator.Name} {creator.LastName}") : "Un administrador";
        
        var group = await _context.Groups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == groupId);
        var groupName = group?.Name ?? "Grupo";

        var targets = await _context.Players.AsNoTracking()
            .Where(p => chosenPlayerIds.Contains(p.Id) && p.Id != creatorId && p.NotifyMatchCreation)
            .Select(p => p.Id)
            .ToListAsync();

        if (targets.Count == 0) return;

        var subscriptions = await _context.PushSubscriptions.AsNoTracking()
            .Where(s => targets.Contains(s.PlayerId))
            .ToListAsync();

        var title = $"[{groupName}] ⚽ Convocatoria";
        var body = $"{creatorName} creó un partido el día {date.ToLocalTime():dd/MM/yyyy} y estás convocado.";
        var url = "/Match/Upcoming";

        foreach (var sub in subscriptions)
        {
            _ = SendNotificationAsync(sub, title, body, url);
        }
    }

    public async Task SendMatchModificationNotificationAsync(int? modifierId, int matchId)
    {
        var match = await _context.Matches.AsNoTracking()
            .Include(m => m.MatchPlayers)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return;

        var group = await _context.Groups.AsNoTracking().FirstOrDefaultAsync(g => g.Id == match.GroupId);
        var groupName = group?.Name ?? "Grupo";

        var modifier = await _context.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Id == modifierId);
        var modifierName = modifier != null ? (!string.IsNullOrWhiteSpace(modifier.Nickname) ? modifier.Nickname : $"{modifier.Name} {modifier.LastName}") : "Un administrador";

        var chosenPlayerIds = match.MatchPlayers.Select(mp => mp.PlayerId).ToList();

        var targets = await _context.Players.AsNoTracking()
            .Where(p => chosenPlayerIds.Contains(p.Id) && p.Id != modifierId && p.NotifyMatchModification)
            .Select(p => p.Id)
            .ToListAsync();

        if (targets.Count == 0) return;

        var subscriptions = await _context.PushSubscriptions.AsNoTracking()
            .Where(s => targets.Contains(s.PlayerId))
            .ToListAsync();

        var title = $"[{groupName}] 🔄 Partido modificado";
        var body = $"{modifierName} modificó el partido del día {match.Date.ToLocalTime():dd/MM/yyyy}.";
        var url = "/Match/Upcoming";

        foreach (var sub in subscriptions)
        {
            _ = SendNotificationAsync(sub, title, body, url);
        }
    }

    public async Task<bool> SubscribePlayerAsync(int playerId, string endpoint, string p256Dh, string auth)
    {
        if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(p256Dh) || string.IsNullOrWhiteSpace(auth))
        {
            return false;
        }

        var existing = await _context.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == endpoint && s.PlayerId == playerId);

        if (existing == null)
        {
            var sub = new PushSubscriptionEntity
            {
                PlayerId = playerId,
                Endpoint = endpoint,
                P256dh = p256Dh,
                Auth = auth,
                CreatedAt = DateTime.UtcNow
            };

            _context.PushSubscriptions.Add(sub);
            await _context.SaveChangesAsync();
        }

        return true;
    }

    public async Task<bool> UnsubscribePlayerAsync(int playerId, string endpoint)
    {
        var existing = await _context.PushSubscriptions
            .FirstOrDefaultAsync(s => s.Endpoint == endpoint && s.PlayerId == playerId);

        if (existing != null)
        {
            _context.PushSubscriptions.Remove(existing);
            await _context.SaveChangesAsync();
            return true;
        }

        return false;
    }

    private class VapidKeysJson
    {
        public string PublicKey { get; set; } = "";
        public string PrivateKey { get; set; } = "";
    }
}
