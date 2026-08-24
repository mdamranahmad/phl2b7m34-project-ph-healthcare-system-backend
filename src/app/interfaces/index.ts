export interface IQuery {
	searchTerm?: string;
	page?: string;
	limit?: string;
	sortOrder?: string;
	sortBy?: string;

	// any other filter fields will be added here
	[key: string]: any;
}
