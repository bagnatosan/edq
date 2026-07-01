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

    public async Task<bool> DeletePlayerAsync(int id)
    {
        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == id);
        if (player == null)
        {
            return false;
        }

        // 1. Eliminar foto física de perfil del disco si existe
        if (!string.IsNullOrEmpty(player.PhotoUrl))
        {
            try
            {
                string oldPhysicalRoute = Path.Combine(_environment.WebRootPath, player.PhotoUrl.TrimStart('/'));
                if (System.IO.File.Exists(oldPhysicalRoute))
                {
                    System.IO.File.Delete(oldPhysicalRoute);
                }
            }
            catch (Exception deleteEx)
            {
                Console.WriteLine($"Error al eliminar la foto del disco al borrar cuenta: {deleteEx.Message}");
            }
        }

        // 2. Eliminar suscripciones push (PushSubscriptions)
        var pushSubs = await _context.PushSubscriptions.Where(ps => ps.PlayerId == id).ToListAsync();
        _context.PushSubscriptions.RemoveRange(pushSubs);

        // 3. Eliminar solicitudes de unión a grupos (Requests)
        var reqs = await _context.Requests.Where(r => r.PlayerId == id).ToListAsync();
        _context.Requests.RemoveRange(reqs);

        // 4. Eliminar votos de encuestas (PollVotes)
        var votes = await _context.PollVotes.Where(v => v.PlayerId == id).ToListAsync();
        _context.PollVotes.RemoveRange(votes);

        // 5. Eliminar mensajes de chat individuales (ChatMessages)
        var msgs = await _context.ChatMessages.Where(m => m.SenderId == id).ToListAsync();
        _context.ChatMessages.RemoveRange(msgs);

        // 6. Eliminar convocatorias a partidos (MatchPlayers)
        var matchPlayers = await _context.MatchPlayers.Where(mp => mp.PlayerId == id).ToListAsync();
        _context.MatchPlayers.RemoveRange(matchPlayers);

        // 7. Eliminar membresías de grupos (GroupPlayers)
        var groupPlayers = await _context.GroupPlayers.Where(gp => gp.PlayerId == id).ToListAsync();
        _context.GroupPlayers.RemoveRange(groupPlayers);

        // 8. Gestionar grupos creados por el usuario (donde CreatorId == id)
        var groupsCreated = await _context.Groups
            .Where(g => g.CreatorId == id)
            .ToListAsync();

        foreach (var group in groupsCreated)
        {
            // Eliminar solicitudes de este grupo
            var groupReqs = await _context.Requests.Where(r => r.GroupId == group.Id).ToListAsync();
            _context.Requests.RemoveRange(groupReqs);

            // Eliminar integrantes
            var groupMembers = await _context.GroupPlayers.Where(gp => gp.GroupId == group.Id).ToListAsync();
            _context.GroupPlayers.RemoveRange(groupMembers);

            // Eliminar partidos y sus convocados
            var groupMatches = await _context.Matches.Where(m => m.GroupId == group.Id).ToListAsync();
            foreach (var match in groupMatches)
            {
                var mPlayers = await _context.MatchPlayers.Where(mp => mp.MatchId == match.Id).ToListAsync();
                _context.MatchPlayers.RemoveRange(mPlayers);
            }
            _context.Matches.RemoveRange(groupMatches);

            // Eliminar encuestas, opciones y votos
            var groupPolls = await _context.Polls.Where(p => p.GroupId == group.Id).ToListAsync();
            foreach (var poll in groupPolls)
            {
                var pVotes = await _context.PollVotes.Where(pv => pv.PollId == poll.Id).ToListAsync();
                _context.PollVotes.RemoveRange(pVotes);

                var pOptions = await _context.PollOptions.Where(po => po.PollId == poll.Id).ToListAsync();
                _context.PollOptions.RemoveRange(pOptions);
            }
            _context.Polls.RemoveRange(groupPolls);

            // Eliminar mensajes del chat del grupo
            var groupMsgs = await _context.ChatMessages.Where(m => m.GroupId == group.Id).ToListAsync();
            _context.ChatMessages.RemoveRange(groupMsgs);

            // Eliminar el grupo
            _context.Groups.Remove(group);
        }

        // 9. Eliminar al jugador
        _context.Players.Remove(player);

        await _context.SaveChangesAsync();
        return true;
    }
}
