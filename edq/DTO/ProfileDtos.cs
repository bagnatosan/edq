using System.ComponentModel.DataAnnotations;

namespace edq.DTO;

public class UpdateNicknameDto
{
    [MaxLength(20, ErrorMessage = "El apodo no puede superar los 20 caracteres.")]
    public string? Nickname { get; set; } = string.Empty;
}

public class NotificationSettingsDto
{
    public bool NotifyMatchCreation { get; set; }
    public bool NotifyMatchModification { get; set; }
    public bool NotifyChat { get; set; }
}

public class DeleteRequestDto
{
    [Required(ErrorMessage = "El correo electrónico es obligatorio.")]
    [EmailAddress(ErrorMessage = "Ingresá un correo electrónico válido.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "La contraseña es obligatoria.")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "Debes ingresar la frase de confirmación.")]
    public string VerificationText { get; set; } = string.Empty;
}
