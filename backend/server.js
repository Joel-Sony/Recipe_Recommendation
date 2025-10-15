
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const uri = "mongodb://localhost:27017"; 
const client = new MongoClient(uri);

let recipesCollection;
let ratingCollection;


async function connectDB(){
    try{
        await client.connect();
        const db = client.db("recipesDB");
        recipesCollection = db.collection("recipes");
        console.log("Connected to MongoDB");
    }
    catch(err){
        console.error("DB connection error: ",err);
    }
}

connectDB();



app.get("/recipes", async (req,res)=>{
    /**
 * @api {get} /recipes Get Recipes
 * @apiDescription Retrieves a list of recipes, supporting keyword search by title and pagination.
 * @apiQuery {String} [search] Filters recipes by title (case-insensitive regex).
 * @apiQuery {Number} [page=1] The current page number.
 * @apiQuery {Number} [limit=10] The number of recipes per page.
 * @apiSuccess {Object[]} recipes Array of recipe objects.
 **/

    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    skip = (page - 1)* limit;
    try{
        const recipes = await recipesCollection
            .find({
                title: {$regex: search, $options:"i"},
                deleted:{ $ne:true}
            })
            .skip(skip)
            .limit(limit)
            .toArray();
        res.json(recipes);
    }
    catch(err){
        res.status(500).json({error: err.message});
    }
});

app.post('/recipes/ingredients', async (req,res)=>{
    /**
 * @api {post} /recipes/ingredients Find Recipes by Ingredients
 * @apiDescription Finds and sorts recipes based on the ingredients provided in the request body.
 * It prioritizes recipes with the most matching ingredients.
 * @apiBody {String[]} ingredients An array of ingredients the user has available.
 * @apiSuccess {Object[]} recipes Array of recipe objects, sorted by 'matchedIngredients' (descending).
 **/
    try{
        const userIngredients = req.body.ingredients;

        if(! Array.isArray(userIngredients)){
            return res.status(400).json({error : "Ingredients must be an array"});
        }

        const recipes = await recipesCollection.aggregate([
            {
                $match: {deleted : {$ne : true}}
            },
            {
                $addFields: {
                matchedIngredients: {
                    $size: {
                        $setIntersection: ["$ingredients", userIngredients]
                    }
                }
                }
            },
        { $match: { matchedIngredients: { $gt: 0 } } },
        { $sort: { matchedIngredients: -1 } } // recipes with more matches first
        ]).toArray();

        res.json(recipes);
    
    }
    catch( err ){
        console.error("Error occured: ",err);
        res.status(500).json({error : "Server error"});
    }
});

app.post('/recipes', async (req,res) =>{
    try{
        const newRecipe = req.body;

        if(!newRecipe.title || !Array.isArray(newRecipe.ingredients)){
            return res.status(400).json({error : "Missing fields: titles or ingredients!"});
        }

        newRecipe.deleted = false;
        const result = await recipesCollection.insertOne(newRecipe);
        res.status(201).json({message : "Recipe added successfully!", id : result.insertedId});
    }
    catch(err){
        res.status(500).json({error : err.message});
    }
})

app.put("/recipes/:id", async(req, res)=>{
    try{
        const id = req.params.id;
        const updatedFields = req.body;

        await recipesCollection.updateOne(
            {_id: new ObjectId(id)},
            {$set: updatedFields}
        )

        res.json({message : "Updated successfully!"});
    }
    catch(err){
        res.status(500).json({error : err.message});
    }
})

app.delete("/recipes/:id", async(req, res)=>{
    try{
        const id = req.params.id;

        await recipesCollection.updateOne(
            {_id: new ObjectId(id)},
            {$set: {deleted : true}}
        );

        res.json({message : "Deleted successfully!"});
    }
    catch(err){
        res.status(500).json({error : err.message});
    }
})

app.patch("/recipes/:id/restore", async(req, res) =>{
    try{
        const id = req.params.id

        await recipesCollection.updateOne(
            {_id : new ObjectId(id)},
            {$set : {deleted : false}}
        )

        res.json({ message : "Recipe Restored succesfully!"});
    }
    catch(err){
        res.status(500).json({error : err.message});
    }
})


app.get("/recipes/trashed", async (req, res) => {
     try{
        const trashed = await recipesCollection.find({deleted : true}).toArray();
        res.json(trashed);
    }
    catch(err){
        res.status(500).json({error : err.message});
    }
})

app.delete("/recipes/:id/permanent", async (req, res) => {
  try {
    const id = req.params.id;
    await recipesCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ message: "Recipe permanently deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post("/recipes/:id/rate", async (req, res) => {
  try {
    const id = req.params.id.trim();
    const { score } = req.body;

    // Validate score
    if (typeof score !== "number" || score < 0) {
      return res.status(400).json({ error: "Invalid score value" });
    }

    // Step 1: Find the recipe
    const recipe = await recipesCollection.findOne({ _id: new ObjectId(id) });
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Step 2: Compute new values
    const newNumRatings = (recipe.num_ratings ?? 0) + 1;
    const newTotalScore = (recipe.total_score ?? 0) + score;
    const newAverage = newTotalScore / newNumRatings;

    // Step 3: Update the document
    await recipesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { num_ratings: newNumRatings, total_score: newTotalScore, rating: newAverage } }
    );

    // Step 4: Fetch the updated document
    const updatedRecipe = await recipesCollection.findOne({ _id: new ObjectId(id) });

    // Step 5: Send response
    res.json({
      message: "Rating updated successfully!",
      recipe: updatedRecipe
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));