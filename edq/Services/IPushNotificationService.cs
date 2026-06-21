using edq.Models;
using System.Threading.Tasks;

namespace edq.Services;

public interface IPushNotificationService
{
    string GetVapidPublicKey();
    Task SendNotificationAsync(PushSubscriptionEntity subscription, string title, string body, string url);
    Task SendNotificationToGroupAsync(int groupId, string title, string body, string url, int excludePlayerId = 0);
    Task<bool> SubscribePlayerAsync(int playerId, string endpoint, string p256dh, string auth);
    Task<bool> UnsubscribePlayerAsync(int playerId, string endpoint);
}
