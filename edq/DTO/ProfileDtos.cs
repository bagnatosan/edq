namespace edq.DTO;

public class UpdateNicknameDto
{
    public string Nickname { get; set; } = string.Empty;
}

public class NotificationSettingsDto
{
    public bool NotifyMatchCreation { get; set; }
    public bool NotifyMatchModification { get; set; }
    public bool NotifyChat { get; set; }
}
