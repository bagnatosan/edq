using System;
using System.Linq;
using System.Threading.Tasks;
using edq.Data;
using edq.Models;
using edq.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace edq.Tests
{
    public class TestWebHostEnvironment : IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = AppDomain.CurrentDomain.BaseDirectory;
        public string ApplicationName { get; set; } = "edq";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = AppDomain.CurrentDomain.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
        public string EnvironmentName { get; set; } = "Development";
    }

    public class AuthServiceTests
    {
        private DbContextOptions<ApplicationDbContext> CreateNewContextOptions()
        {
            return new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
        }

        [Fact]
        public async Task DeletePlayerAsync_ShouldDeletePlayerAndAllCascadingData()
        {
            // Arrange
            var options = CreateNewContextOptions();
            var testEnv = new TestWebHostEnvironment();

            using (var context = new ApplicationDbContext(options))
            {
                // Seed Player
                var player = new Player
                {
                    Id = 1,
                    Name = "Santiago",
                    LastName = "Bagnato",
                    Email = "santiago@test.com",
                    Password = "hashed_password",
                    PhotoUrl = "/images/profiles/test_photo.png"
                };
                context.Players.Add(player);

                // Seed another Player (member)
                var member = new Player
                {
                    Id = 2,
                    Name = "John",
                    LastName = "Doe",
                    Email = "john@test.com",
                    Password = "hashed_password"
                };
                context.Players.Add(member);

                // Seed Group created by Player 1
                var group = new Group
                {
                    Id = 1,
                    Name = "Fútbol 5",
                    CreatorId = 1
                };
                context.Groups.Add(group);

                // Seed Group Membership
                var groupPlayer = new GroupPlayer
                {
                    GroupId = 1,
                    PlayerId = 1
                };
                context.GroupPlayers.Add(groupPlayer);

                // Seed Match
                var match = new Match
                {
                    Id = 1,
                    GroupId = 1,
                    Date = DateTime.UtcNow
                };
                context.Matches.Add(match);

                // Seed Match Player
                var matchPlayer = new MatchPlayer
                {
                    MatchId = 1,
                    PlayerId = 1,
                    Team = 1
                };
                context.MatchPlayers.Add(matchPlayer);

                // Seed Chat Message
                var message = new ChatMessage
                {
                    Id = 1,
                    GroupId = 1,
                    SenderId = 1,
                    MessageText = "Hola a todos"
                };
                context.ChatMessages.Add(message);

                // Seed Push Subscription
                var pushSub = new PushSubscriptionEntity
                {
                    Id = 1,
                    PlayerId = 1,
                    Endpoint = "https://endpoint.com",
                    P256dh = "p256dh",
                    Auth = "auth"
                };
                context.PushSubscriptions.Add(pushSub);

                // Seed Request
                var request = new Request
                {
                    Id = 1,
                    GroupId = 1,
                    PlayerId = 1,
                    State = "Pending"
                };
                context.Requests.Add(request);

                await context.SaveChangesAsync();
            }

            // Act
            using (var context = new ApplicationDbContext(options))
            {
                var authService = new AuthService(context, testEnv);
                var result = await authService.DeletePlayerAsync(1);

                // Assert
                Assert.True(result);

                // Verify player is deleted
                var deletedPlayer = await context.Players.FirstOrDefaultAsync(p => p.Id == 1);
                Assert.Null(deletedPlayer);

                // Verify other player still exists
                var remainingPlayer = await context.Players.FirstOrDefaultAsync(p => p.Id == 2);
                Assert.NotNull(remainingPlayer);

                // Verify groups created by player are deleted
                var deletedGroup = await context.Groups.FirstOrDefaultAsync(g => g.Id == 1);
                Assert.Null(deletedGroup);

                // Verify cascading deletions of the group/player data
                Assert.Empty(context.GroupPlayers.Where(gp => gp.PlayerId == 1));
                Assert.Empty(context.MatchPlayers.Where(mp => mp.PlayerId == 1));
                Assert.Empty(context.ChatMessages.Where(m => m.SenderId == 1));
                Assert.Empty(context.PushSubscriptions.Where(ps => ps.PlayerId == 1));
                Assert.Empty(context.Requests.Where(r => r.PlayerId == 1));
            }
        }
    }
}
