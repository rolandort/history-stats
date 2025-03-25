document.addEventListener('DOMContentLoaded', function() {
  console.log("History Plugin loaded...");
  const tbody = document.getElementById('history-data');
  const categoryFilter = document.getElementById('category-filter');
  const dateFilter = document.getElementById('date-filter');
  const prevDayButton = document.getElementById('prev-day');
  const nextDayButton = document.getElementById('next-day');
  const themeButton = document.getElementById('theme-switch');
  let historyChart = null;
  let categoryChart = null;
  let currentHistoryItems = [];
  let currentCategories = [];

  // Initialize theme
  initializeTheme(themeButton);

  // Load categories initially
  browser.storage.sync.get('categories').then(result => {
    currentCategories = result.categories || [];
    updateCategoryFilter(currentCategories);
  }).catch(error => {
    console.error('Error loading categories:', error);
  });

  // Listen for theme changes to update charts
  document.addEventListener('themeChanged', () => {
    if (currentHistoryItems.length > 0) {
      updateDisplayForCategory(currentHistoryItems);
      updateCategoryChart(currentHistoryItems);
    }
  });

  // Set default date to today
  const today = new Date();
  dateFilter.value = today.toISOString().split('T')[0];
  updateNavigationButtons();
  
  // Add settings link handler
  document.getElementById('openSettings').addEventListener('click', function(e) {
    e.preventDefault();
    browser.runtime.openOptionsPage();
    window.close();
  });

  // Add extended view handler
  document.getElementById('openExtended').addEventListener('click', function(e) {
    e.preventDefault();
    browser.tabs.create({
      url: browser.runtime.getURL('extension-page/index.html')
    });
    window.close();
  });

  // Add close button handler
  document.getElementById('close-popup').addEventListener('click', function() {
    window.close();
  });

  // Add category filter handler
  categoryFilter.addEventListener('change', function() {
    updateDisplayForCategory(currentHistoryItems);
  });

  // Add date filter handler
  dateFilter.addEventListener('change', function() {
    loadHistoryForDate(dateFilter.value);
    updateNavigationButtons();
  });

  // Add date navigation handlers
  prevDayButton.addEventListener('click', function() {
    const currentDate = new Date(dateFilter.value);
    currentDate.setDate(currentDate.getDate() - 1);
    dateFilter.value = currentDate.toISOString().split('T')[0];
    loadHistoryForDate(dateFilter.value);
    updateNavigationButtons();
  });

  nextDayButton.addEventListener('click', function() {
    const currentDate = new Date(dateFilter.value);
    currentDate.setDate(currentDate.getDate() + 1);
    dateFilter.value = currentDate.toISOString().split('T')[0];
    loadHistoryForDate(dateFilter.value);
    updateNavigationButtons();
  });

  function updateNavigationButtons() {
    const currentDate = new Date(dateFilter.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Disable next day button if current date is today
    nextDayButton.disabled = currentDate.getTime() >= today.getTime();
    
    // Update button styles
    nextDayButton.style.opacity = nextDayButton.disabled ? '0.5' : '1';
    nextDayButton.style.cursor = nextDayButton.disabled ? 'not-allowed' : 'pointer';
  }

  function updateCategoryChart(historyItems) {
    if (!historyItems || historyItems.length === 0 || !currentCategories || currentCategories.length === 0) {
      createCategoryChart(['No Data'], [0]);
      return;
    }

    const categoryStats = {
      'Uncategorized': 0
    };

    currentCategories.forEach(category => {
      categoryStats[category.title] = 0;
    });

    historyItems.forEach(item => {
      const category = matchUrlToCategory(item.url, currentCategories);
      categoryStats[category]++;
    });

    // Sort categories but exclude Uncategorized
    const sortedCategories = Object.entries(categoryStats)
      .filter(([category]) => category !== 'Uncategorized')
      .sort(([,a], [,b]) => b - a);

    // Add Uncategorized at the end if it has any entries
    if (categoryStats['Uncategorized'] > 0) {
      sortedCategories.push(['Uncategorized', categoryStats['Uncategorized']]);
    }

    const categories = sortedCategories.map(([category]) => category);
    const counts = sortedCategories.map(([,count]) => count);

    // Create colors array with gray for Uncategorized
    const colors = categories.map((category, index) => {
      if (category === 'Uncategorized') {
        return 'hsla(0, 0%, 75%, 0.7)'; // gray color for Uncategorized
      }
      const hue = (index * 137.508) % 360;
      return `hsla(${hue}, 70%, 60%, 0.7)`;
    });

    const borderColors = colors.map(color => {
      if (color === 'hsla(0, 0%, 75%, 0.7)') {
        return 'hsla(0, 0%, 75%, 1)'; // solid gray for Uncategorized border
      }
      return color.replace('0.7', '1');
    });

    createCategoryChart(categories, counts, colors, borderColors);
  }

  function createCategoryChart(categories, counts, colors, borderColors) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    if (categoryChart) {
      categoryChart.destroy();
    }

    categoryChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Page Visits'],
        datasets: categories.map((category, index) => ({
          label: category,
          data: [counts[index]],
          backgroundColor: colors[index],
          borderColor: borderColors[index],
          borderWidth: 1,
          borderRadius: 3,
          borderSkipped: 'middle'
        }))
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Categories',
            align: 'start',
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-color')
          },
          grid: {
            display: false
          },
          legend: {
            display: false,
            position: 'bottom',
            boxWidth: 9,
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-color'),
              font: {
                size: 9
              },
              generateLabels: function(chart) {
                const datasets = chart.data.datasets;
                return datasets.map((dataset, i) => {
                  const value = dataset.data[0];
                  const total = datasets.reduce((acc, ds) => acc + ds.data[0], 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return {
                    text: `${dataset.label} (${percentage}%)`,
                    fillStyle: dataset.backgroundColor,
                    strokeStyle: dataset.borderColor,
                    lineWidth: 1,
                    hidden: false,
                    index: i
                  };
                });
              }
            }
          },
          tooltip: {
            callbacks: {
              title: () => null,
            }
         }
        },
        scales: {
          x: {
            border: {
              display: false
            },
            stacked: true,
            grid: {
              display: false
            },
            ticks: {
              display: false
            }
          },
          y: {
            border: {
              display: false
            },
            stacked: true,
            grid: {
              display: false
            },
            ticks: {
              display: false
            }
          }
        }
      }
    });
  }

  function loadHistoryForDate(dateString) {
    const selectedDate = new Date(dateString);
    const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);

    browser.history.search({
      text: '',
      startTime: startOfDay.getTime(),
      endTime: endOfDay.getTime(),
      maxResults: 10000
    }).then(historyItems => {
      // Update stacked chart with all items (unfiltered)
      updateCategoryChart(historyItems);
      
      // Store items for filtering
      currentHistoryItems = historyItems;
      
      // Update history chart with filtered items
      updateDisplayForCategory(historyItems);
    }).catch(onError);
  }

  function matchUrlToCategory(url, categories) {
    for (const category of categories) {
      try {
        const pattern = new RegExp(category.pattern);
        if (pattern.test(url)) {
          return category.title;
        }
      } catch (e) {
        console.error(`Invalid regex pattern for category ${category.title}:`, e);
      }
    }
    return 'Uncategorized';
  }

  function createChart(intervals, counts, chartTitle) {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    if (historyChart) {
      historyChart.destroy();
    }

    historyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: intervals,
        datasets: [{
          label: 'Pages',
          data: counts,
          borderWidth: 1,
          pointStyle: false,
          borderRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: chartTitle,
            align: 'start',
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-color')
          }
        },
        scales: {
          x: {
            type: "time",
            time: {
              parser: 'H:m',
              unit: 'hour',
              stepSize: 1,
              min: '00:00',
              max: '23:59',
              displayFormats: {
                hour: 'H',
              }
            },
            grid: {
              display: false,
              color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid'),
              drawOnChartArea: true,
              drawTicks: true
            },
            ticks: {
              source: 'auto',
              autoSkip: false,
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-color'),
              font: {
                size: 10
              },
              align: 'start',
              maxRotation: 0,
  						minRotation: 0
            },
            min: moment('00:00', 'HH:mm').toDate(),
            max: moment('23:59', 'HH:mm').toDate(),
            title: {
              display: false,
              text: 'Time of Day',
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-color'),
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--chart-grid')
            },
            ticks: {
              precision: 0,
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-color'),
              font: {
                size: 10
              }
            },
            title: {
              display: false,
              text: 'Number of Pages Visited',
              color: getComputedStyle(document.documentElement).getPropertyValue('--text-color'),
            
              // padding: { bottom: 10 }
            }
          }
        }
      }
    });
  }

  function updateDisplayForCategory(historyItems) {
    if (!historyItems || historyItems.length === 0) {
      createChart([], [], 'No Data');
      return;
    }

    // Initialize 10-minute interval stats (144 intervals in a day)
    const intervalStats = {};
    for (let interval = 0; interval < 144; interval++) {
      intervalStats[interval] = 0;
    }
    
    // Get start and end of selected day
    const selectedDate = new Date(dateFilter.value);
    const startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(startOfDay.getDate() + 1);
    
    // Filter by selected category
    const selectedCategory = categoryFilter.value;
    const filteredItems = selectedCategory === 'all' ? 
      historyItems : 
      historyItems.filter(item => matchUrlToCategory(item.url, currentCategories) === selectedCategory);
    
    // Fill in the actual visit counts for filtered items
    filteredItems.forEach(item => {
      if (item && item.lastVisitTime) {
        const visitTime = new Date(item.lastVisitTime);
        if (visitTime >= startOfDay && visitTime < endOfDay) {
          // Calculate which 10-minute interval this falls into
          const minutes = visitTime.getHours() * 60 + visitTime.getMinutes();
          const interval = Math.floor(minutes / 10);
          intervalStats[interval]++;
        }
      }
    });

    // Create arrays for chart data
    const intervals = Object.keys(intervalStats).map(interval => {
      const intervalNum = parseInt(interval);
      const hours = Math.floor((intervalNum * 10) / 60);
      const minutes = (intervalNum * 10) % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    });
    const counts = Object.values(intervalStats);

    // Update chart title to include category info
    const chartTitle = selectedCategory === 'all' ? 
      (selectedDate.toDateString() === new Date().toDateString() ? 'Today\'s Activity' : 
        `Activity on ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`) :
      (selectedDate.toDateString() === new Date().toDateString() ? `Today's ${selectedCategory} Activity)` : 
        `${selectedCategory} Activity on ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`);

    // Create the chart with updated title
    createChart(intervals, counts, chartTitle);
  }

  function updateTable(historyItems) {
    currentHistoryItems = historyItems;
    
    // Load categories and update display
    browser.storage.sync.get('categories').then(result => {
      currentCategories = result.categories || [];
      updateCategoryFilter(currentCategories);
      updateDisplayForCategory(historyItems);
    }).catch(error => {
      console.error('Error loading categories:', error);
      updateDisplayForCategory(historyItems);
    });
  }

  function updateCategoryFilter(categories) {
    // Store current selection
    const currentValue = categoryFilter.value;
    
    // Clear existing options except "All Categories"
    while (categoryFilter.options.length > 1) {
      categoryFilter.remove(1);
    }

    // Add categories to dropdown
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.title;
      option.textContent = category.title;
      categoryFilter.appendChild(option);
    });

    // Add Uncategorized option
    const uncategorizedOption = document.createElement('option');
    uncategorizedOption.value = 'Uncategorized';
    uncategorizedOption.textContent = 'Uncategorized';
    categoryFilter.appendChild(uncategorizedOption);

    // Restore selection if it exists, otherwise default to "all"
    if (Array.from(categoryFilter.options).some(opt => opt.value === currentValue)) {
      categoryFilter.value = currentValue;
    } else {
      categoryFilter.value = 'all';
    }
  }

  function onError(error) {
    console.error('Error:', error);
  }

  try {
    // Initial load with today's date
    loadHistoryForDate(dateFilter.value);
  } catch (error) {
    onError(error);
  }
});