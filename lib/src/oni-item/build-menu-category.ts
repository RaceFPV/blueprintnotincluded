export class BuildMenuCategory {
    category: string;
    categoryIconUrl: string;
    categoryShowName: string;
    
    constructor(category: string, categoryIcon: string) {
        this.category = category;
        this.categoryIconUrl = `assets/images/${categoryIcon}`;
        this.categoryShowName = category;
    }

    static buildMenuCategories: BuildMenuCategory[] = [];
} 
