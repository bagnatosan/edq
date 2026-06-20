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

namespace edq.Controllers;

public class AccountController : Controller
{
    private readonly IAuthService _authService;

    public AccountController(IAuthService authService)
    {
        _authService = authService;
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
}
