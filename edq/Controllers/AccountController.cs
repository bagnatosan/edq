using edq.DTO;
using edq.Models;
using edq.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.IO;
using Microsoft.AspNetCore.Authorization;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Formats.Webp;

namespace edq.Controllers;

public class AccountController : Controller
{
    private readonly IAuthService _authService;
    private readonly IWebHostEnvironment _environment;

    public AccountController(IAuthService authService, IWebHostEnvironment environment)
    {
        _authService = authService;
        _environment = environment;
    }

    // GET: /Account/Login
    [HttpGet]
    public IActionResult Login()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Explore", "Group");
        }
        return View();
    }

    // POST: /Account/Login
    [HttpPost]
    public async Task<IActionResult> Login(LoginDto model)
    {
        if (ModelState.IsValid)
        {
            var jugador = await _authService.LoginAsync(model.Email, model.Password);
            if (jugador != null)
            {
                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, jugador.Id.ToString()),
                    new Claim(ClaimTypes.Name, jugador.Name),
                    new Claim(ClaimTypes.Email, jugador.Email)
                };

                var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);

                var authProperties = new AuthenticationProperties
                {
                    IsPersistent = model.RememberMe,
                    ExpiresUtc = model.RememberMe 
                        ? DateTimeOffset.UtcNow.AddDays(30) 
                        : null
                };

                await HttpContext.SignInAsync(
                    CookieAuthenticationDefaults.AuthenticationScheme,
                    new ClaimsPrincipal(claimsIdentity),
                    authProperties
                );

                return RedirectToAction("Explore", "Group");
            }

            ModelState.AddModelError(string.Empty, "Correo o contraseña incorrectos.");
        }

        return View(model);
    }

    // POST: /Account/Register
    [HttpPost]
    public async Task<IActionResult> Register(RegisterDto model)
    {
        if (ModelState.IsValid)
        {
            var jugador = await _authService.RegisterAsync(model);
            if (jugador != null)
            {
                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, jugador.Id.ToString()),
                    new Claim(ClaimTypes.Name, jugador.Name),
                    new Claim(ClaimTypes.Email, jugador.Email)
                };

                var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);

                await HttpContext.SignInAsync(
                    CookieAuthenticationDefaults.AuthenticationScheme,
                    new ClaimsPrincipal(claimsIdentity)
                );

                return RedirectToAction("Explore", "Group");
            }

            ModelState.AddModelError("Email", "El correo electrónico ya está registrado.");
        }

        ViewBag.ShowRegisterOnLoad = true;
        return View("Login");
    }

    // POST: /Account/Logout
    [HttpPost]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction("Index", "Home");
    }

    // GET: /Account/Profile
    [HttpGet]
    [Authorize]
    public async Task<IActionResult> Profile()
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdString) || !int.TryParse(userIdString, out int userId))
        {
            return RedirectToAction("Login", "Account");
        }

        var player = await _authService.GetPlayerByIdAsync(userId);
        if (player == null)
        {
            return RedirectToAction("Login", "Account");
        }

        return View(player);
    }

    // POST: /Account/UpdateNickname
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> UpdateNickname([FromBody] UpdateNicknameDto model)
    {
        if (model == null || string.IsNullOrWhiteSpace(model.Nickname))
        {
            return BadRequest(new { message = "El apodo no puede estar vacío." });
        }

        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdString) || !int.TryParse(userIdString, out int userId))
        {
            return Unauthorized();
        }

        var success = await _authService.UpdatePlayerNicknameAsync(userId, model.Nickname.Trim());
        if (!success)
        {
            return NotFound(new { message = "Usuario no encontrado." });
        }

        return Ok(new { nickname = model.Nickname.Trim() });
    }

    // POST: /Account/UpdatePhoto
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> UpdatePhoto(IFormFile photo)
    {
        if (photo == null || photo.Length == 0)
        {
            return BadRequest(new { message = "No se ha proporcionado ninguna imagen válida." });
        }

        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdString) || !int.TryParse(userIdString, out int userId))
        {
            return Unauthorized();
        }

        try
        {
            string carpetaDestino = Path.Combine(_environment.WebRootPath, "images", "profiles");
            
            // Asegurar que exista la carpeta
            if (!Directory.Exists(carpetaDestino))
            {
                Directory.CreateDirectory(carpetaDestino);
            }

            // Generar nombre de archivo único con extensión .webp para máxima compresión
            string nombreUnico = Guid.NewGuid().ToString() + ".webp";
            string rutaFisicaCompleta = Path.Combine(carpetaDestino, nombreUnico);

            // Procesar y guardar la imagen de forma optimizada
            using (var image = await Image.LoadAsync(photo.OpenReadStream()))
            {
                // Redimensionar si excede 300px manteniendo la relación de aspecto
                image.Mutate(x => x.Resize(new ResizeOptions
                {
                    Size = new Size(300, 300),
                    Mode = ResizeMode.Max
                }));

                // Guardar como WebP con calidad del 75%
                var encoder = new WebpEncoder
                {
                    Quality = 75
                };
                await image.SaveAsync(rutaFisicaCompleta, encoder);
            }

            string photoUrl = "/images/profiles/" + nombreUnico;
            var success = await _authService.UpdatePlayerPhotoAsync(userId, photoUrl);
            if (!success)
            {
                return NotFound(new { message = "Usuario no encontrado." });
            }

            return Ok(new { photoUrl });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error al procesar la imagen: " + ex.Message });
        }
    }

    // POST: /Account/UpdateNotificationSettings
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> UpdateNotificationSettings([FromBody] NotificationSettingsDto model)
    {
        if (model == null)
        {
            return BadRequest(new { message = "Datos inválidos." });
        }

        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userIdString) || !int.TryParse(userIdString, out int userId))
        {
            return Unauthorized();
        }

        var success = await _authService.UpdatePlayerNotificationSettingsAsync(userId, model.NotifyMatchCreation, model.NotifyMatchModification, model.NotifyChat);
        if (!success)
        {
            return BadRequest(new { message = "No se pudieron actualizar los ajustes." });
        }

        return Ok(new { success = true });
    }
}
