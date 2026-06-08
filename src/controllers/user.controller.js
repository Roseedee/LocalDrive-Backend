const userRepo = require('../repositories/user.repository')

exports.getUserSuggestion = async (req, res) => {
    try {
        const { query } = req.query
    
        if (!query) {
            return res.status(400).json({
                error: "query is required"
            });
        }

        const users = await userRepo.findByNameOrUsername(query)
    
        return res.json({
            status: 'ok',
            users: users
        })
    }catch(err) {
        console.error(err)
        res.status(500).json({ error: "failed to get user suggestion" });
    }
}