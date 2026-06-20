using edq.DTO;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace edq.Services;

public interface IGroupService
{
    Task<(List<GroupDto> MyGroups, List<GroupDto> OtherGroups)> GetGroupsAsync(int userId, string? search, int skip, int take);
    Task<JoinRequestResult> RequestJoinGroupAsync(int userId, int groupId);
    Task<bool> CanAccessDashboardAsync(int userId, int groupId);
    Task<GroupDashboardDto?> GetGroupDashboardDataAsync(int userId, int groupId);
    Task<bool> AcceptRequestAsync(int userId, int requestId);
    Task<bool> DeclineRequestAsync(int userId, int requestId);
    Task<bool> UpdateMemberScoresAsync(int userId, int groupId, List<MemberScoreUpdateDto> updates);
    Task<bool> CreateTemporaryPlayerAsync(int userId, int groupId, string name, string lastName, byte initialScore);
    Task<List<MatchHistoryDto>?> GetMatchHistoryAsync(int userId, int groupId);
    Task<bool> UpdateGroupNameAsync(int userId, int groupId, string newName);
    Task<bool> RemoveMemberAsync(int userId, int groupId, int playerId);
}

