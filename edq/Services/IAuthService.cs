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
}
