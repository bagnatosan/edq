using System;
using System.Collections.Generic;

namespace edq.DTO;

public class ChatMessageDto
{
    public int Id { get; set; }
    public int SenderId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string SenderInitials { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
    public string MessageText { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }
}

public class PollVoterDto
{
    public int PlayerId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Nickname { get; set; }
    public string Initials { get; set; } = string.Empty;
    public string? PhotoUrl { get; set; }
}

public class PollOptionDto
{
    public int Id { get; set; }
    public string OptionText { get; set; } = string.Empty;
    public int VoteCount { get; set; }
    public bool UserVoted { get; set; }
    public List<PollVoterDto> Voters { get; set; } = new();
}

public class PollDto
{
    public int Id { get; set; }
    public int CreatorId { get; set; }
    public string CreatorName { get; set; } = string.Empty;
    public string CreatorInitials { get; set; } = string.Empty;
    public string? CreatorPhotoUrl { get; set; }
    public string Question { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public List<PollOptionDto> Options { get; set; } = new();
}

public class CreatePollRequestDto
{
    public int GroupId { get; set; }
    public string Question { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public int DurationMinutes { get; set; } = 1440;
}

public class VoteRequestDto
{
    public int PollId { get; set; }
    public int OptionId { get; set; }
}
