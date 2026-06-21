using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace edq.Migrations
{
    /// <inheritdoc />
    public partial class AddTargetDateToPoll : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "TargetDate",
                table: "Polls",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TargetDate",
                table: "Polls");
        }
    }
}
