using edq.DTO;
using edq.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using SkiaSharp;

namespace edq.Controllers;

public class AccountController : Controller
{
    private readonly IAuthService _authService;
    private readonly IWebHostEnvironment _environment;
    private readonly IEmailService _emailService;

    public AccountController(IAuthService authService, IWebHostEnvironment environment, IEmailService emailService)
    {
        _authService = authService;
        _environment = environment;
        _emailService = emailService;
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
    public async Task<IActionResult>Login(LoginDto model)
    {
        if (ModelState.IsValid)
        {
            var player = await _authService.LoginAsync(model.Email, model.Password);
            if (player != null)
            {
                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, player.Id.ToString()),
                    new Claim(ClaimTypes.Name, player.Name),
                    new Claim(ClaimTypes.Email, player.Email)
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
            var player = await _authService.RegisterAsync(model);
            if (player != null)
            {
                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, player.Id.ToString()),
                    new Claim(ClaimTypes.Name, player.Name),
                    new Claim(ClaimTypes.Email, player.Email)
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
        var userId = GetUserId();
        if (userId == null)
        {
            return RedirectToAction("Login", "Account");
        }

        var player = await _authService.GetPlayerByIdAsync(userId.Value);
        if (player == null)
        {
            return RedirectToAction("Login", "Account");
        }

        return View(player);
    }

    // POST: /Account/UpdateNickname
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> UpdateNickname([FromBody] UpdateNicknameDto? model)
    {
        if (model == null || string.IsNullOrWhiteSpace(model.Nickname))
            return BadRequest(new { message = "El apodo no puede estar vacío." });

        if (model.Nickname.Length > 20)
            return BadRequest(new { message = "El apodo no puede superar los 20 caracteres." });

        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var success = await _authService.UpdatePlayerNicknameAsync(userId.Value, model.Nickname.Trim());
        if (!success)
        {
            return NotFound(new { message = "Usuario no encontrado." });
        }

        return Ok(new { nickname = model.Nickname.Trim() });
    }

    // POST: /Account/UpdatePhoto
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> UpdatePhoto(IFormFile? photo)
    {
        if (photo == null || photo.Length == 0)
        {
            return BadRequest(new { message = "No se ha proporcionado ninguna imagen válida." });
        }

        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        // Obtener jugador para consultar foto anterior
        var player = await _authService.GetPlayerByIdAsync(userId.Value);
        if (player == null)
        {
            return NotFound(new { message = "Usuario no encontrado." });
        }
        string? oldPhotoUrl = player.PhotoUrl;

        try
        {
            string folderDestination = Path.Combine(_environment.WebRootPath, "images", "profiles");
            
            // Asegurar que exista la carpeta
            if (!Directory.Exists(folderDestination))
            {
                Directory.CreateDirectory(folderDestination);
            }

            // Generar nombre de archivo único con extensión .webp para máxima compresión
            string uniqueName = Guid.NewGuid().ToString() + ".webp";
            string completePhysicalRoute = Path.Combine(folderDestination, uniqueName);

            // Procesar y guardar la imagen de forma optimizada con SkiaSharp
            using var inputStream = photo.OpenReadStream();
            using var originalBitmap = SKBitmap.Decode(inputStream)
                ?? throw new InvalidOperationException("No se pudo decodificar la imagen.");

            // Calcular nuevo tamaño manteniendo la relación de aspecto (máximo 300px)
            const int maxSize = 300;
            int srcW = originalBitmap.Width;
            int srcH = originalBitmap.Height;
            float scale = Math.Min((float)maxSize / srcW, (float)maxSize / srcH);
            int newW = scale < 1f ? (int)(srcW * scale) : srcW;
            int newH = scale < 1f ? (int)(srcH * scale) : srcH;

            using var resized = originalBitmap.Resize(new SKImageInfo(newW, newH), new SKSamplingOptions(SKCubicResampler.Mitchell));
            using var skImage = SKImage.FromBitmap(resized);

            // Guardar como WebP con calidad del 75%
            using var webpData = skImage.Encode(SKEncodedImageFormat.Webp, 75);
            await using var fileStream = new FileStream(completePhysicalRoute, FileMode.Create, FileAccess.Write);
            webpData.SaveTo(fileStream);

            string photoUrl = "/images/profiles/" + uniqueName;
            var success = await _authService.UpdatePlayerPhotoAsync(userId.Value, photoUrl);
            if (!success)
            {
                return NotFound(new { message = "Usuario no encontrado." });
            }

            // Eliminar físicamente la foto anterior del servidor si era una imagen local
            if (!string.IsNullOrEmpty(oldPhotoUrl) && oldPhotoUrl.StartsWith("/images/profiles/", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    string oldFilename = Path.GetFileName(oldPhotoUrl);
                    string oldPhysicalRoute = Path.Combine(folderDestination, oldFilename);
                    if (System.IO.File.Exists(oldPhysicalRoute))
                    {
                        System.IO.File.Delete(oldPhysicalRoute);
                    }
                }
                catch (Exception deleteEx)
                {
                    Console.WriteLine($"Error al eliminar la foto anterior del disco: {deleteEx.Message}");
                }
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
    public async Task<IActionResult> UpdateNotificationSettings([FromBody] NotificationSettingsDto? model)
    {
        if (model == null)
        {
            return BadRequest(new { message = "Datos inválidos." });
        }

        var userId = GetUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        var success = await _authService.UpdatePlayerNotificationSettingsAsync(userId.Value, model.NotifyMatchCreation, model.NotifyMatchModification, model.NotifyChat);
        if (!success)
        {
            return BadRequest(new { message = "No se pudieron actualizar los ajustes." });
        }

        return Ok(new { success = true });
    }

    // GET: /Account/ForgotPassword
    [HttpGet]
    public IActionResult ForgotPassword()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Explore", "Group");
        }
        return View();
    }

    // POST: /Account/ForgotPassword
    [HttpPost]
    public async Task<IActionResult> ForgotPassword(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            ModelState.AddModelError(string.Empty, "El correo electrónico es obligatorio.");
            return View();
        }

        var exists = await _authService.EmailExistsAsync(email.Trim());
        if (!exists)
        {
            ModelState.AddModelError(string.Empty, "El correo electrónico no está registrado.");
            return View();
        }

        // Generar un código de verificación de tipo ushort (1000 - 9999)
        ushort recoveryCode = (ushort)Random.Shared.Next(1000, 10000);

        // Guardar temporalmente en TempData
        TempData["ResetEmail"] = email.Trim();
        TempData["ResetCode"] = (int)recoveryCode;
        TempData.Keep();

        try
        {
            // Enviar el correo electrónico
            string subject = "Código de recuperación de contraseña - edq.";
            string body = $@"
                <div style='font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;'>
                    <h2 style='color: #8aff00;'>Recuperación de Contraseña</h2>
                    <p>Hola,</p>
                    <p>Recibimos una solicitud para restablecer tu contraseña en edq.</p>
                    <p>Tu código de recuperación es:</p>
                    <div style='background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #333;'>
                        {recoveryCode}
                    </div>
                    <p style='color: #666; font-size: 12px; margin-top: 20px;'>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                </div>";

            await _emailService.SendEmailAsync(email.Trim(), subject, body);
            
            return RedirectToAction("VerifyCode");
        }
        catch (Exception ex)
        {
            ModelState.AddModelError(string.Empty, $"Error al enviar el correo: {ex.Message}. Por favor verifica las credenciales de SmtpSettings en appsettings.json.");
            return View();
        }
    }

    // GET: /Account/VerifyCode
    [HttpGet]
    public IActionResult VerifyCode()
    {
        var email = TempData["ResetEmail"]?.ToString();
        if (string.IsNullOrEmpty(email))
        {
            return RedirectToAction("ForgotPassword");
        }

        ViewBag.Email = email;
        TempData.Keep();
        return View();
    }

    // POST: /Account/VerifyCode
    [HttpPost]
    public IActionResult VerifyCode(ushort? code)
    {
        var email = TempData["ResetEmail"]?.ToString();
        var savedCodeObj = TempData["ResetCode"];

        if (string.IsNullOrEmpty(email) || savedCodeObj == null)
        {
            return RedirectToAction("ForgotPassword");
        }

        ViewBag.Email = email;
        TempData.Keep();

        if (code == null)
        {
            ModelState.AddModelError(string.Empty, "El código es obligatorio.");
            return View();
        }

        ushort savedCode = (ushort)(int)savedCodeObj;
        if (code != savedCode)
        {
            ModelState.AddModelError(string.Empty, "Código incorrecto.");
            return View();
        }

        // Autorizar cambio de contraseña
        TempData["CodeVerified"] = true;
        TempData.Keep();

        return RedirectToAction("ResetPassword");
    }

    // GET: /Account/ResetPassword
    [HttpGet]
    public IActionResult ResetPassword()
    {
        var email = TempData["ResetEmail"]?.ToString();
        var verified = TempData["CodeVerified"] as bool?;

        if (string.IsNullOrEmpty(email) || verified != true)
        {
            return RedirectToAction("ForgotPassword");
        }

        TempData.Keep();
        return View();
    }

    // POST: /Account/ResetPassword
    [HttpPost]
    public async Task<IActionResult> ResetPassword(string newPassword, string confirmPassword)
    {
        var email = TempData["ResetEmail"]?.ToString();
        var verified = TempData["CodeVerified"] as bool?;

        if (string.IsNullOrEmpty(email) || verified != true)
        {
            return RedirectToAction("ForgotPassword");
        }

        TempData.Keep();

        if (string.IsNullOrWhiteSpace(newPassword) || string.IsNullOrWhiteSpace(confirmPassword))
        {
            ModelState.AddModelError(string.Empty, "Ambos campos son obligatorios.");
            return View();
        }

        if (newPassword != confirmPassword)
        {
            ModelState.AddModelError(string.Empty, "Las contraseñas no coinciden.");
            return View();
        }

        var success = await _authService.ResetPasswordAsync(email, newPassword);
        if (!success)
        {
            ModelState.AddModelError(string.Empty, "No se pudo restablecer la contraseña. El usuario no fue encontrado.");
            return View();
        }

        // Limpiar TempData
        TempData.Remove("ResetEmail");
        TempData.Remove("ResetCode");
        TempData.Remove("CodeVerified");

        TempData["SuccessMessage"] = "Contraseña restablecida correctamente. Ya puedes iniciar sesión.";

        return RedirectToAction("Login");
    }
    
    private int? GetUserId()
    {
        var userIdString = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(userIdString, out var userId) ? userId : null;
    }
}
