//For those wondering what in the world this is, this is the badge data for all of the badges public_flags represents in a seperate file so it's not as much of a mess
const badgeArr = [
	[
		"staff",
		{
			id: "staff",
			description: "staff",
			translate: true,
			icon: "5e74e9b61934fc1f67c65515d1f7e60d",
		},
	],
	[
		"partner",
		{
			id: "partner",
			description: "partner",
			translate: true,
			icon: "3f9748e53446a137a052f3454e2de41e",
		},
	],
	[
		"certified_moderator",
		{
			id: "certified_moderator",
			description: "certified_moderator",
			translate: true,
			icon: "fee1624003e2fee35cb398e125dc479b",
		},
	],
	[
		"hypesquad",
		{
			id: "hypesquad",
			description: "hypesquad",
			translate: true,
			icon: "bf01d1073931f921909045f3a39fd264",
		},
	],
	[
		"hypesquad_house_1",
		{
			id: "hypesquad_house_1",
			description: "hypesquad_house_1",
			translate: true,
			icon: "8a88d63823d8a71cd5e390baa45efa02",
		},
	],
	[
		"hypesquad_house_2",
		{
			id: "hypesquad_house_2",
			description: "hypesquad_house_2",
			translate: true,
			icon: "011940fd013da3f7fb926e4a1cd2e618",
		},
	],
	[
		"hypesquad_house_3",
		{
			id: "hypesquad_house_3",
			description: "hypesquad_house_3",
			translate: true,
			icon: "3aa41de486fa12454c3761e8e223442e",
		},
	],
	[
		"bug_hunter_level_1",
		{
			id: "bug_hunter_level_1",
			description: "bug_hunter_level_1",
			translate: true,
			icon: "2717692c7dca7289b35297368a940dd0",
		},
	],
	[
		"bug_hunter_level_2",
		{
			id: "bug_hunter_level_2",
			description: "bug_hunter_level_2",
			translate: true,
			icon: "848f79194d4be5ff5f81505cbd0ce1e6",
		},
	],
	[
		"active_developer",
		{
			id: "active_developer",
			description: "active_developer",
			translate: true,
			icon: "6bdc42827a38498929a4920da12695d9",
		},
	],
	[
		"verified_developer",
		{
			id: "verified_developer",
			description: "verified_developer",
			translate: true,
			icon: "6df5892e0f35b051f8b61eace34f4967",
		},
	],
	[
		"early_supporter",
		{
			id: "early_supporter",
			description: "early_supporter",
			translate: true,
			icon: "7060786766c9c840eb3019e725d2b358",
		},
	],
	[
		"premium",
		{
			id: "premium",
			description: "premium",
			translate: true,
			icon: "2ba85e8026a8614b640c2837bcdfe21b",
		},
	],
	[
		"guild_booster_lvl1",
		{
			id: "guild_booster_lvl1",
			description: "guild_booster_lvl1",
			translate: true,
			icon: "51040c70d4f20a921ad6674ff86fc95c",
		},
	],
	[
		"guild_booster_lvl2",
		{
			id: "guild_booster_lvl2",
			description: "guild_booster_lvl2",
			translate: true,
			icon: "0e4080d1d333bc7ad29ef6528b6f2fb7",
		},
	],
	[
		"guild_booster_lvl3",
		{
			id: "guild_booster_lvl3",
			description: "guild_booster_lvl3",
			translate: true,
			icon: "72bed924410c304dbe3d00a6e593ff59",
		},
	],
	[
		"guild_booster_lvl4",
		{
			id: "guild_booster_lvl4",
			description: "guild_booster_lvl4",
			translate: true,
			icon: "df199d2050d3ed4ebf84d64ae83989f8",
		},
	],
	[
		"guild_booster_lvl5",
		{
			id: "guild_booster_lvl5",
			description: "guild_booster_lvl5",
			translate: true,
			icon: "996b3e870e8a22ce519b3a50e6bdd52f",
		},
	],
	[
		"guild_booster_lvl6",
		{
			id: "guild_booster_lvl6",
			description: "guild_booster_lvl6",
			translate: true,
			icon: "991c9f39ee33d7537d9f408c3e53141e",
		},
	],
	[
		"guild_booster_lvl7",
		{
			id: "guild_booster_lvl7",
			description: "guild_booster_lvl7",
			translate: true,
			icon: "cb3ae83c15e970e8f3d410bc62cb8b99",
		},
	],
	[
		"guild_booster_lvl8",
		{
			id: "guild_booster_lvl8",
			description: "guild_booster_lvl8",
			translate: true,
			icon: "7142225d31238f6387d9f09efaa02759",
		},
	],
	[
		"guild_booster_lvl9",
		{
			id: "guild_booster_lvl9",
			description: "guild_booster_lvl9",
			translate: true,
			icon: "ec92202290b48d0879b7413d2dde3bab",
		},
	],
	[
		"bot_commands",
		{
			id: "bot_commands",
			description: "bot_commands",
			translate: true,
			icon: "6f9e37f9029ff57aef81db857890005e",
		},
	],
	[
		"automod",
		{
			id: "automod",
			description: "automod",
			translate: true,
			icon: "f2459b691ac7453ed6039bbcfaccbfcd",
		},
	],
	[
		"application_guild_subscription",
		{
			id: "application_guild_subscription",
			description: "application_guild_subscription",
			translate: true,
			icon: "d2010c413a8da2208b7e4f35bd8cd4ac",
		},
	],
	[
		"legacy_username",
		{
			id: "legacy_username",
			description: "legacy_username",
			translate: true,
			icon: "6de6d34650760ba5551a79732e98ed60",
		},
	],
	[
		"quest_completed",
		{
			id: "quest_completed",
			description: "quest_completed",
			translate: true,
			icon: "7d9ae358c8c5e118768335dbe68b4fb8",
		},
	],
] as const;
export {badgeArr};
