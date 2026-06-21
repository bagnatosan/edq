using edq.Data;
using edq.DTO;
using edq.Models;
using Isopoh.Cryptography.Argon2;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using System;
using System.IO;
using System.Threading.Tasks;

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
        var usuarioExistente = await _context.Players.AnyAsync(p => p.Email == model.Email);
        if (usuarioExistente)
        {
            return null;
        }

        // 2. Procesar el guardado de la foto si subió una
        string? rutaFoto = null;
        if (model.ProfilePhoto != null && model.ProfilePhoto.Length > 0)
        {
            string carpetaDestino = Path.Combine(_environment.WebRootPath, "images", "profiles");
            
            // Asegurar que exista la carpeta
            if (!Directory.Exists(carpetaDestino))
            {
                Directory.CreateDirectory(carpetaDestino);
            }

            // Generar nombre de archivo único
            string nombreUnico = Guid.NewGuid().ToString() + "_" + Path.GetFileName(model.ProfilePhoto.FileName);
            string rutaFisicaCompleta = Path.Combine(carpetaDestino, nombreUnico);

            // Guardar físicamente
            using (var stream = new FileStream(rutaFisicaCompleta, FileMode.Create))
            {
                await model.ProfilePhoto.CopyToAsync(stream);
            }

            rutaFoto = "/images/profiles/" + nombreUnico;
        }

        // 3. Hashear la contraseña usando Argon2id
        string passwordHash = Argon2.Hash(model.Password);

        // 4. Crear el nuevo Player
        var nuevoJugador = new Player
        {
            Name = model.Name,
            LastName = model.LastName,
            Email = model.Email,
            Nickname = model.Nickname,
            Password = passwordHash, // Se guarda el hash
            PhotoUrl = rutaFoto
        };

        _context.Players.Add(nuevoJugador);
        await _context.SaveChangesAsync();

        return nuevoJugador;
    }

    public async Task<Player?> LoginAsync(string email, string password)
    {
        // 1. Buscar jugador por correo
        var jugador = await _context.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Email == email);
        if (jugador == null)
        {
            return null;
        }

        // 2. Verificar el hash de contraseña usando Argon2id
        bool contraseniaValida = Argon2.Verify(jugador.Password, password);
        if (!contraseniaValida)
        {
            return null;
        }

        return jugador;
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
}
