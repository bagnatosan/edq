using System.ComponentModel.DataAnnotations;

namespace edq.Models;

public class Player
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(20)]
    public string Name { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(20)]
    public string LastName  { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(20)]
    public string Email { get; set; } = string.Empty;
    
    [MaxLength(20)]
    public string? Nickname { get; set; }

    public string? PhotoUrl { get; set; } //wwwroot/images/profilesd

    [Required]
    public string Password { get; set; } = string.Empty;

    public bool NotifyMatchCreation { get; set; } = true;
    public bool NotifyMatchModification { get; set; } = true;
    public bool NotifyChat { get; set; } = true;

    // Iniciales calculadas al vuelo (no guardadas en base de datos)
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public string Initials => 
        $"{(string.IsNullOrWhiteSpace(Name) ? "" : Name[0])}{(string.IsNullOrWhiteSpace(LastName) ? "" : LastName[0])}".ToUpper();
}