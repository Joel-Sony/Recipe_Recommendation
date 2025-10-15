
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

app.post('/recipes/:id/rate', async (req, res) => {
    const recipeId = req.params.id;
    const score = req.body.score; // The score (1-5) sent from the frontend

    // 1. Input Validation
    if (!score || score < 1 || score > 5) {
        return res.status(400).json({ message: "Rating score must be between 1 and 5." });
    }

    try {
        // 2. Find and Update the Recipe
        // Assuming your Recipe model has 'num_ratings' (count) and 'total_score'
        const updatedRecipe = await ratingCollection.findByIdAndUpdate(
            recipeId,
            {
                $inc: { 
                    num_ratings: 1, 
                    total_score: score 
                }
            },
            { new: true } // Return the updated document
        );

        if (!updatedRecipe) {
            return res.status(404).json({ message: "Recipe not found." });
        }

        // 3. Recalculate Average Rating (Optional, but good practice)
        const avgRating = updatedRecipe.num_ratings > 0 
            ? updatedRecipe.total_score / updatedRecipe.num_ratings 
            : 0;
            
        // Final update to store the calculated average rating (if you store it separately)
        updatedRecipe.rating = avgRating;
        await updatedRecipe.save();

        // 4. Respond with the updated recipe data
        res.status(200).json(updatedRecipe);

    } catch (error) {
        console.error("Rating error:", error);
        res.status(500).json({ message: "Server error during rating update." });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));