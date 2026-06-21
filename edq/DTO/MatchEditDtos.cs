using System;
using System.Collections.Generic;

namespace edq.DTO;

public class MatchDetailsDto
{
    public int MatchId { get; set; }
    public int GroupId { get; set; }
    public string GroupName { get; set; } = "";
    public DateTime Date { get; set; }
    public string State { get; set; } = "Pending";
    public bool IsCreator { get; set; }
    public List<MatchPlayerDetailsDto> MatchPlayers { get; set; } = new();
    public List<GroupMemberDetailsDto> GroupMembers { get; set; } = new();
}

public class MatchPlayerDetailsDto
{
    public int PlayerId { get; set; }
    public string Name { get; set; } = "";
    public string Nickname { get; set; } = "";
    public byte Team { get; set; }
}

public class GroupMemberDetailsDto
{
    public int PlayerId { get; set; }
    public string Name { get; set; } = "";
    public string Nickname { get; set; } = "";
    public byte Score { get; set; }
}

public class MatchPlayerUpdateDto
{
    public int PlayerId { get; set; }
    public byte Team { get; set; }
}

public class UpdateMatchRequestDto
{
    public int MatchId { get; set; }
    public DateTime Date { get; set; }
    public List<MatchPlayerUpdateDto> Players { get; set; } = new();
}

public class FinishMatchRequestDto
{
    public int MatchId { get; set; }
    public int TotalGoals { get; set; }
    public int GoalsAhead { get; set; }
    public string Winner { get; set; } = ""; // "A", "B", "Empate"
}
