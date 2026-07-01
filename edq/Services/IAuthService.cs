using edq.DTO;
using edq.Models;
using System.Threading.Tasks;

namespace edq.Services;

public interface IAuthService
{
    Task<Player?> RegisterAsync(RegisterDto model);
    Task<Player?> LoginAsync(string email, string password);
    Task<Player?> GetPlayerByIdAsync(int id);
    Task<bool> UpdatePlayerNicknameAsync(int id, string nickname);
    Task<bool> UpdatePlayerPhotoAsync(int id, string photoUrl);
    Task<bool> UpdatePlayerNotificationSettingsAsync(int id, bool creation, bool modification, bool chat);
    Task<bool> EmailExistsAsync(string email);
    Task<bool> ResetPasswordAsync(string email, string newPassword);
    Task<bool> DeletePlayerAsync(int id);
}
