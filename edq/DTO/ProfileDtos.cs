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
