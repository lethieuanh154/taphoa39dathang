import { Injectable } from '@angular/core';
import * as ApiDataService from '../services/api-data.service'
import { Product } from '../models/product';

@Injectable({
  providedIn: 'root'
})
export class SearchService {

  constructor(private apiDataService: ApiDataService.ApiDataService) { }
  // Function to search for products based on a search term
  onSearch(
    http: any,
    filteredProducts: Product[],
    isLoading: boolean,
    searchTerm: string,
    loadData: (data: Product[]) => void
  ) {
    if (!searchTerm) {
      filteredProducts = [];
      loadData(filteredProducts);
      return;
    }

    // Check if data is cached
    const cacheKey = `search_${searchTerm.replace(/ /g, '_')}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      filteredProducts = JSON.parse(cachedData);
      loadData(filteredProducts);
      return;
    }

    // If no cached data, fetch from API
    this.apiDataService.fetchFromAPI(http, searchTerm, filteredProducts, isLoading, loadData);
    
  }
}
