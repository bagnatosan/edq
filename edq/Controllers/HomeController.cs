using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using edq.DTO;

namespace edq.Controllers;

public class HomeController : Controller
{
    public IActionResult Index()
    {

        if (User.Identity?.IsAuthenticated == true)
        {
            return RedirectToAction("Explore", "Group");
        }
        return View();
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error(string? message)
    {
        var exceptionHandlerPathFeature = HttpContext.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerPathFeature>();
        var errorMsg = message ?? exceptionHandlerPathFeature?.Error.Message ?? "Algo salió mal en el servidor. Por favor, vuelve a intentarlo.";

        return View(new ErrorViewModel 
        { 
            RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier,
            ErrorMessage = errorMsg
        });
    }

    // Página sin conexión: servida por el Service Worker cuando no hay red ni caché
    [AllowAnonymous]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Offline()
    {
        return View("Error", new ErrorViewModel
        {
            RequestId = string.Empty,
            ErrorMessage = "No hay conexión a internet. Revisá tu red y volvé a intentarlo."
        });
    }
}