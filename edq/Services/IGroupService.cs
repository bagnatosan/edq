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
}
