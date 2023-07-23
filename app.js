const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const axios = require("axios");
const path = require("path");

const databasePath = path.join(__dirname, "database.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//get total month sale

app.get("/totalItems-sale-amount/:month", async (req, res) => {
  const { month } = req.params;
  const totalQuery = `
    SELECT 
    SUM(CASE WHEN strftime('%m', dateOfSale) = "${month}" AND sold =1  THEN price ELSE 0 END) AS totalSaleAmount,
    COUNT(CASE WHEN strftime('%m', dateOfSale) = "${month}"  AND sold = 1 THEN price END) AS totalSoldItems,
    COUNT(CASE WHEN strftime('%m', dateOfSale) = "${month}"  AND sold = 0 THEN price END) AS totalNotSoldItems
    FROM 
    amazon;

    `;
  const result = await database.all(totalQuery);
  res.send(result);
});

// bar chart data

app.get("/bar-chart-data/:month", async (req, res) => {
  const { month } = req.params;
  const dataQuery = `
  SELECT
  CASE
    WHEN price BETWEEN 0 AND 100 THEN '0 - 100'
    WHEN price BETWEEN 101 AND 200 THEN '101 - 200'
    WHEN price BETWEEN 201 AND 300 THEN '201 - 300'
    WHEN price BETWEEN 301 AND 400 THEN '301 - 400'
    WHEN price BETWEEN 401 AND 500 THEN '401 - 500'
    WHEN price BETWEEN 501 AND 600 THEN '501 - 600'
    WHEN price BETWEEN 601 AND 700 THEN '601 - 700'
    WHEN price BETWEEN 701 AND 800 THEN '701 - 800'
    WHEN price BETWEEN 801 AND 900 THEN '801 - 900'
    ELSE '901-above'
  END AS priceRange,
  COUNT(*) AS itemCount
FROM amazon
WHERE strftime('%m', dateOfSale ) = "${month}"
GROUP BY priceRange
ORDER BY MIN(price);

  `;
  const result = await database.all(dataQuery);
  res.json(result);
});

//api for pie chart ,unique categories and number of items in a month

app.get("/unique-category/:month", async (req, res) => {
  const { month } = req.params;
  const uniqueQuery = `
    SELECT distinct category, COUNT(*) AS itemsCount FROM amazon WHERE strftime('%m', dateOfSale)= "${month}"
    GROUP BY  category;`;
  const result = await database.all(uniqueQuery);
  res.send(result);
});

//combined api response

const fetchDataFromAPI = async (url) => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching data from API:", error.message);
    return null;
  }
};

// API to get combined data for a specific month using path parameter
app.get("/combined-data/:month", async (req, res) => {
  const { month } = req.params;

  try {
    // Fetch data from the three APIs asynchronously
    const salesData = await fetchDataFromAPI(
      `http://localhost:3000/totalItems-sale-amount/${month}`
    );
    const barChartData = await fetchDataFromAPI(
      `http://localhost:3000/bar-chart-data/${month}`
    );
    const pieChartData = await fetchDataFromAPI(
      `http://localhost:3000/unique-category/${month}`
    );

    // Combine the data into a single JSON object
    const combinedData = {
      sales: salesData,
      barChart: barChartData,
      pieChart: pieChartData,
    };

    res.json(combinedData);
  } catch (error) {
    console.error("Error combining data:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = app;
