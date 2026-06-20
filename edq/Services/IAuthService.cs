using edq.DTO;
using edq.Models;
using System.Threading.Tasks;

namespace edq.Services;

public interface IAuthService
{
    Task<Player?> RegisterAsync(RegisterDto model);
    Task<Player?> LoginAsync(string email, string password);
}
