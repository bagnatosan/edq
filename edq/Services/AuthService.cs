using edq.Data;
using edq.DTO;
using edq.Models;
using Isopoh.Cryptography.Argon2;
using Microsoft.EntityFrameworkCore;

namespace edq.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _context;
    private readonly IWebHostEnvironment _environment;

    public AuthService(ApplicationDbContext context, IWebHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
    }

    public async Task<Player?> RegisterAsync(RegisterDto model)
    {
        // 1. Verificar si el correo ya existe
        var userExists = await _context.Players.AnyAsync(p => p.Email == model.Email);
        if (userExists)
        {
            return null;
        }

        // 2. Procesar el guardado de la foto si subió una
        string? photoRoute = null;
        if (model.ProfilePhoto != null && model.ProfilePhoto.Length > 0)
        {
            string folderDestination = Path.Combine(_environment.WebRootPath, "images", "profiles");
            
            // Asegurar que exista la carpeta
            if (!Directory.Exists(folderDestination))
            {
                Directory.CreateDirectory(folderDestination);
            }

            // Generar nombre de archivo único
            string uniqueName = Guid.NewGuid().ToString() + "_" + Path.GetFileName(model.ProfilePhoto.FileName);
            string completePhysicalRoute = Path.Combine(folderDestination, uniqueName);

            // Guardar físicamente
            await using (var stream = new FileStream(completePhysicalRoute, FileMode.Create))
            {
                await model.ProfilePhoto.CopyToAsync(stream);
            }

            photoRoute = "/images/profiles/" + uniqueName;
        }

        // 3. Hashear la contraseña usando Argon2id
        string passwordHash = Argon2.Hash(model.Password);

        // 4. Crear el nuevo Player
        var newPlayer = new Player
        {
            Name = model.Name,
            LastName = model.LastName,
            Email = model.Email,
            Nickname = model.Nickname,
            Password = passwordHash, // Se guarda el hash
            PhotoUrl = photoRoute
        };

        _context.Players.Add(newPlayer);
        await _context.SaveChangesAsync();

        return newPlayer;
    }

    public async Task<Player?> LoginAsync(string email, string password)
    {
        // 1. Buscar jugador por correo
        var player = await _context.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Email == email);
        if (player == null)
        {
            return null;
        }

        // 2. Verificar el hash de contraseña usando Argon2id
        bool invalidPassword = Argon2.Verify(player.Password, password);
        if (!invalidPassword)
        {
            return null;
        }

        return player;
    }

    public async Task<Player?> GetPlayerByIdAsync(int id)
    {
        return await _context.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<bool> UpdatePlayerNicknameAsync(int id, string nickname)
    {
        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == id);
        if (player == null)
        {
            return false;
        }

        player.Nickname = nickname;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdatePlayerPhotoAsync(int id, string photoUrl)
    {
        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == id);
        if (player == null)
        {
            return false;
        }

        player.PhotoUrl = photoUrl;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdatePlayerNotificationSettingsAsync(int id, bool creation, bool modification, bool chat)
    {
        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == id);
        if (player == null)
        {
            return false;
        }

        player.NotifyMatchCreation = creation;
        player.NotifyMatchModification = modification;
        player.NotifyChat = chat;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> EmailExistsAsync(string email)
    {
        return await _context.Players.AnyAsync(p => p.Email == email);
    }

    public async Task<bool> ResetPasswordAsync(string email, string newPassword)
    {
        var player = await _context.Players.FirstOrDefaultAsync(p => p.Email == email);
        if (player == null)
        {
            return false;
        }

        // Hashear usando Argon2id
        player.Password = Argon2.Hash(newPassword);
        await _context.SaveChangesAsync();
        return true;
    }
}
