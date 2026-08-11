export type reportTypes =
	| "message"
	| "user"
	| "guild_discovery"
	| "guild"
	| "guild_scheduled_event"
	| "stage_channel"
	| "first_dm"
	| "user"
	| "application"
	| "widget"
	| "guild_directory_entry";
export type buttonTypes =
	| "submit" // This button shows a warning about making false reports along with the submit and back button
	| "done" //This button just shows a Done button without a back button
	| "cancel" //This button may provide a back button, but does not provide a button to move forward
	| "next"; //This button takes you to the next node along with a back button
interface reportElementBase {
	name: string;
	type: string;
	/**
	 * Data used for more complex elements to allow for things like checkboxes or additional information
	 */
	data: unknown;
	/**
	 * Set only if the elements information should be submitted, only ever true with the checkbox type
	 */
	should_submit_data: boolean;
	/**
	 * This tag is used for if the element should not be rendered if its not been translated into the users language
	 */
	skip_if_unlocalized: boolean;
	is_localized: boolean | null;
}
type singleElementTypes =
	| "message_preview" //Shows the user a preview of the message
	| "app_preview" // Shows you what you're reporting the user for
	| "guild_preview" // Shows the user a preview of reported guild
	| "guild_directory_entry_preview" // Shows the user a preview of the dirrectory the user is reporting
	| "guild_scheduled_event_preview" //Shows the user a preview of the event the user is reporting
	| "channel_preview" //shows the user a preview of the reported channel
	| "widget_preview" //show the user a preview of the reported widget
	| "breadcrumbs" // I think this is a defunct element that visually does not do anything, but was at one point a signal to include the breadcrumbs of how the user got there.
	| "fail" // used in the failed menus
	| "share_with_parents" // Offers to the user to shares report with parents (if applicable)
	| "block_users" // Offers to the user to block them
	| "mute_users" // Offers to the user to mute the user (if applicable)
	| "success" // Used to notate a report that succeeded
	| "ignore_users" // Offers to the user to ignore them
	| "settings_upsells" // Additional settings actions that can be taken
	| "delete_message" // Offers to delete the message (if applicable)
	| "user_preview" // Shows a preview of the user
	| "skip" // Exits the menu and does not allow for going back
	| "leave_guild" // An option to let you leave the guild
	| "deauthorize_app" //An option to deauthorize the app
	| "guild_discovery_preview";

interface singleElementReport<X extends singleElementTypes> extends reportElementBase {
	name: X;
	type: X;
	data: null;
	/**
	 * If the element has no text to be localized, it is localized
	 */
	is_localized: true;
	should_submit_data: false;
}

interface externalLinkReport extends reportElementBase {
	name: "external_link";
	type: "external_link";
	data: {
		is_localized: null | boolean;
		link_text: string;
		url: string;
		link_description: null | string;
		/**
		 * If this is defined, it means to just not render it, not sure why this exists
		 */
		is_header_hidden?: true;
	};
	should_submit_data: false;
}
interface selectReport extends reportElementBase {
	name: string;
	type: "checkbox";
	/**
	 * [actual_name, human_readable_name, ?description]
	 */
	data: ([string, string] | [string, string, string])[];
	should_submit_data: true;
}
interface dropdownReport extends reportElementBase {
	name: string;
	type: "dropdown";
	data: {
		title: string;
		options: {
			/**
			 * Used for what to send to the APU
			 */
			value: string;
			label: string;
		}[];
	};
	should_submit_data: true;
}

interface freeTextReport extends reportElementBase {
	name: string;
	type: "free_text";
	data: {
		title?: string;

		subtitle?: string;
		placeholder?: string;
		/**
		 * Number of visible text rows
		 */
		rows: number;
		character_limit: number;
		/**
		 * It must match this regex pattern
		 */
		pattern?: string;
	};
	should_submit_data: true;
}
interface selfHarmHelp extends reportElementBase {
	name: string;
	type: "text_line_resource";
	data: {
		is_localized: boolean;
		title: string;
		body: string;
		sms: string;
		/**
		 * The information to send in the text message
		 */
		sms_body: string;
	};
	should_submit_data: false;
}
interface reportText extends reportElementBase {
	name: "text";
	type: "text";
	data: {
		header: string;
		body: string;
		is_localized: boolean;
	};
}
export type reportElements =
	| singleElementReport<singleElementTypes>
	| externalLinkReport
	| selectReport
	| selfHarmHelp
	| reportText
	| freeTextReport
	| dropdownReport;
export interface report {
	name: reportTypes;
	variant: string;
	version: string;

	/**
	 * this is an relative URL in respect to the API base URL in JS to implement correctly do `new URL(report.postback_url, api_url)`
	 */
	postback_url: string;
	/**
	 * this is the node the reporting process should start on
	 */
	root_node_id: number;
	success_node_id: number;
	fail_node_id: number;
	/**
	 * defaults to english
	 */
	language?: string;
	nodes: {
		[key: string]: reportNode;
	};
}
export interface reportNode {
	id: number;
	/**
	 * this key is likely only used for translation reasons, and is not used during the reporting process
	 */
	key: string;
	header: string;
	subheader: string | null;
	/**
	 * information about a certain section displayed in a special box
	 */
	info: null | string;
	/**
	 * the button at the bottom of the report box
	 */
	button: {
		type: buttonTypes;
		target: null | number;
	} | null;
	/**
	 * these are the elements that aren't the buttons to just continue along and may provide information to the user, or present the user with more options
	 */
	elements: reportElements[];
	/**
	 * this says what type of thing the user is reporting, though isn't actually used in the process of reporting
	 */
	report_type: null | string;
	/**
	 * These are the options with the strings leading to the numbers which represent the nodes to go to
	 */
	children: [string, number][];
	/**
	 * This is true if the checkbox element is required to have at least one element selected to continue
	 */
	is_multi_select_required: boolean;
	/**
	 * Used if this screen automatically submits the report without additional input
	 */
	is_auto_submit: boolean;
}
export interface reportPut {
	version: string;
	variant: string;
	language: string;
	/**
	 * This is the node path that the user took to get here, which includes the submit/auto_submit screens
	 */
	breadcrumbs: number[];
	/**
	 * This is for various elements, this will return all of the things selected with the key being the name
	 */
	elements: {
		[key: string]: string[] | string;
	};

	name: reportTypes;
}

export interface reportMessagePut extends reportPut {
	channel_id: string;
	message_id: string;
	name: "message";
}
export interface reportGuildDiscovery extends reportPut {
	guild_id: string;
	name: "guild_discovery";
}
export interface reportFirstDMPut extends reportPut {
	channel_id: string;
	message_id: string;
	name: "first_dm";
}
export interface reportGuildDirPut extends reportPut {
	channel_id: string;
	guild_id: string;
	name: "guild_directory_entry";
}
export interface reportGuildPut extends reportPut {
	guild_id: string;
	name: "guild";
}
export interface reportStagePut extends reportPut {
	guild_id: string;
	user_id: string;
	stage_instance_id: string;
	name: "stage_channel";
}
export interface reportGuildEventPut extends reportPut {
	guild_id: string;
	guild_scheduled_event_id: string;
	name: "guild_scheduled_event";
}
export interface reportApplicationPut extends reportPut {
	application_id: string;
	name: "application";
}
export interface reportUserPut extends reportPut {
	guild_id: string;
	user_id: string;
	name: "user";
}
export interface reportWidgetPut extends reportPut {
	user_id: string;
	widget_id: string;
	name: "widget";
}
