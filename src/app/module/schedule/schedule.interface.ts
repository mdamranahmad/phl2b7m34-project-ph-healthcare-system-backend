export interface ICreateSchedulePayload {
	startDateTime: Date;
	endtDateTime: Date;
	meetingLink: string;
}

export interface IUpdateSchedulePayload {
	startDateTime?: Date;
	endtDateTime?: Date;
	meetingLink?: string;
}
