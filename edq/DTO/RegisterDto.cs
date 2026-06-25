using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace edq.DTO;

public class RegisterDto
{
    [Required(ErrorMessage = "El nombre es requerido.")]
    [MaxLength(30, ErrorMessage = "El nombre no puede superar los 30 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "El apellido es requerido.")]
    [MaxLength(30, ErrorMessage = "El apellido no puede superar los 30 caracteres.")]
    public string LastName { get; set; } = string.Empty;

    [Required(ErrorMessage = "El correo electrónico es requerido.")]
    [EmailAddress(ErrorMessage = "Formato de correo electrónico inválido.")]
    [MaxLength(50, ErrorMessage = "El correo electrónico no puede superar los 50 caracteres.")]
    public string Email { get; set; } = string.Empty;

    [MaxLength(20, ErrorMessage = "El apodo no puede superar los 20 caracteres.")]
    public string? Nickname { get; set; }

    [Required(ErrorMessage = "La contraseña es requerida.")]
    [DataType(DataType.Password)]
    [MinLength(6, ErrorMessage = "La contraseña debe tener al menos 6 caracteres.")]
    [MaxLength(20, ErrorMessage = "La contraseña no puede superar los 20 caracteres.")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "La confirmación de la contraseña es requerida.")]
    [DataType(DataType.Password)]
    [Compare("Password", ErrorMessage = "Las contraseñas no coinciden.")]
    [MaxLength(20, ErrorMessage = "La contraseña no puede superar los 20 caracteres.")]
    public string ConfirmPassword { get; set; } = string.Empty;

    public IFormFile? ProfilePhoto { get; set; }
}
