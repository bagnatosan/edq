using System;
using System.Collections.Generic;

namespace edq.DTO;

public class GroupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string CreatorName { get; set; } = null!;
    public int MemberCount { get; set; }
    public bool IsCreator { get; set; }
    public bool IsMember { get; set; }
    public string? RequestStatus { get; set; }
}

public enum JoinRequestResult
{
    SuccessPending,
    SuccessApproved,
    GroupNotFound,
    IsCreator,
    AlreadyMember,
    AlreadyRequested
}

public class GroupDashboardDto
{
    public int GroupId { get; set; }
    public string GroupName { get; set; } = null!;
    public bool IsCreator { get; set; }
    public List<GroupMemberDto> Members { get; set; } = new();
    public List<PendingRequestDto>? PendingRequests { get; set; }
    public UpcomingMatchDto? UpcomingMatch { get; set; }
}

public class GroupMemberDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string Nickname { get; set; } = null!;
    public string? PhotoUrl { get; set; }
    public string Initials { get; set; } = null!;
    public double Score { get; set; }
    public double Winrate { get; set; } // Porcentaje de victorias (0 a 100)
}

public class PendingRequestDto
{
    public int RequestId { get; set; }
    public int PlayerId { get; set; }
    public string Name { get; set; } = null!;
    public string Nickname { get; set; } = null!;
    public string? PhotoUrl { get; set; }
    public string Initials { get; set; } = null!;
}

public class MemberScoreUpdateDto
{
    public int PlayerId { get; set; }
    public byte Score { get; set; }
}

public class UpcomingMatchDto
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public List<string> Team1 { get; set; } = new();
    public List<string> Team2 { get; set; } = new();
}

public class MatchHistoryDto
{
    public int MatchId { get; set; }
    public DateTime Date { get; set; }
    public string Result { get; set; } = null!; // Ejemplo: "3-2"
    public List<string> Team1 { get; set; } = new();
    public List<string> Team2 { get; set; } = new();
}
