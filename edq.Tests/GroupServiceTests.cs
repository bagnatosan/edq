using edq.Data;
using edq.DTO;
using edq.Models;
using edq.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace edq.Tests
{
    public class GroupServiceTests
    {
        private DbContextOptions<ApplicationDbContext> CreateNewContextOptions()
        {
            return new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
        }

        [Fact]
        public async Task RequestJoinGroupAsync_ShouldMergeTemporaryPlayerWithRealPlayerWhenNamesMatch()
        {
            // Arrange
            var options = CreateNewContextOptions();
            int groupId = 1;
            int tempPlayerId = 10;
            int realPlayerId = 20;

            using (var context = new ApplicationDbContext(options))
            {
                // 1. Creador del grupo
                var creator = new Player
                {
                    Id = 99,
                    Name = "Admin",
                    LastName = "Creator",
                    Email = "admin@test.com",
                    Password = "hashed_password"
                };
                context.Players.Add(creator);

                // 2. Grupo
                var group = new Group
                {
                    Id = groupId,
                    Name = "Fútbol 5 Semanal",
                    CreatorId = 99
                };
                context.Groups.Add(group);

                // 3. Jugador temporal en el grupo
                var tempPlayer = new Player
                {
                    Id = tempPlayerId,
                    Name = "Santiago",
                    LastName = "Bagnato",
                    Email = "dummy_123456@edq.temp",
                    Password = "DUMMY_PASSWORD"
                };
                context.Players.Add(tempPlayer);

                var tempGp = new GroupPlayer
                {
                    GroupId = groupId,
                    PlayerId = tempPlayerId,
                    Score = 8
                };
                context.GroupPlayers.Add(tempGp);

                // 4. Partido
                var match = new Match
                {
                    Id = 5,
                    GroupId = groupId,
                    Date = DateTime.UtcNow
                };
                context.Matches.Add(match);

                // 5. Convocatoria del jugador temporal en el partido
                var matchPlayer = new MatchPlayer
                {
                    MatchId = 5,
                    PlayerId = tempPlayerId,
                    Team = 1
                };
                context.MatchPlayers.Add(matchPlayer);

                // 6. Nuevo jugador real registrado (que ingresa con el mismo nombre y apellido)
                var realPlayer = new Player
                {
                    Id = realPlayerId,
                    Name = "sAnTiAgO", // Probar case-insensitivity
                    LastName = "bAgNaTo",
                    Email = "santiago@realmail.com",
                    Password = "real_password"
                };
                context.Players.Add(realPlayer);

                await context.SaveChangesAsync();
            }

            // Act
            using (var context = new ApplicationDbContext(options))
            {
                var groupService = new GroupService(context);
                var result = await groupService.RequestJoinGroupAsync(realPlayerId, groupId);

                // Assert
                Assert.Equal(JoinRequestResult.SuccessApproved, result);

                // Verificar que el jugador temporal fue eliminado del sistema
                var deletedTemp = await context.Players.FirstOrDefaultAsync(p => p.Id == tempPlayerId);
                Assert.Null(deletedTemp);
                var deletedTempGp = await context.GroupPlayers.FirstOrDefaultAsync(gp => gp.GroupId == groupId && gp.PlayerId == tempPlayerId);
                Assert.Null(deletedTempGp);

                // Verificar que el jugador real ahora pertenece al grupo
                var realGp = await context.GroupPlayers.FirstOrDefaultAsync(gp => gp.GroupId == groupId && gp.PlayerId == realPlayerId);
                Assert.NotNull(realGp);
                Assert.Equal(8, realGp.Score); // Debe conservar el nivel del temporal (8)

                // Verificar que la convocatoria del partido se migró al jugador real
                var migratedMatchPlayers = await context.MatchPlayers.Where(mp => mp.MatchId == 5).ToListAsync();
                Assert.Single(migratedMatchPlayers);
                Assert.Equal(realPlayerId, migratedMatchPlayers[0].PlayerId);
                Assert.Equal(1, migratedMatchPlayers[0].Team);
            }
        }
    }
}
