import { 
  JSON_INTERPRETER, 
  JSON_REQUEST, 
  JSON_API_TEMPLATE, 
  MERMAID_INTERPRETER,
  MERMAID_TEMPLATE,
  SOLUTION_TEMPLATE
} from "@/lib/prompt";
import { apiResponse, explainResponse } from '@/lib/mock'
import { LLMChain, PromptTemplate, OpenAI } from "langchain";
import axios from "axios";
import type { NextApiRequest, NextApiResponse } from "next";

const request_url = process.env.BASE_API_URL + '/QuickPricingAppletService/analyzeAutoChannelForApplet'


export const handler = async (req: NextApiRequest, res: NextApiResponse) => {

  // construct json request
  const {query: prompt} = req.body;
  const llm = new OpenAI(
    { 
      openAIApiKey: process.env.OPENAI_API_KEY, 
      temperature: 0, 
      modelName: "gpt-3.5-turbo" 
    },
    {
      basePath: process.env.BASE_URL
    }
    );
  const promptTemplate = new PromptTemplate({
    template: JSON_REQUEST,
    inputVariables: ["Input"],
  });
  
  const jsonRequestChain = new LLMChain({ llm, prompt: promptTemplate });
  console.log('Step0, json request', prompt);
  
  try {
    const jsonRequest = await jsonRequestChain.call({ Input: prompt })
    console.log(
      'Step1, Response with json request:', jsonRequest.text
    )
    // request for api
    const response = await axios.post(
      request_url, 
      jsonRequest.text, 
      {
        headers: {
          "Accept": "*/*",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "zh-CN,zh;q=0.9",
          "Connection": "keep-alive",
          "Content-Type": "application/json",
        }
      }
    );
    console.log('Step2, Reponse for api', JSON.stringify(response.data));
    
    // // explain json response
    const start = JSON.parse(jsonRequest.text).ANode
    const end = JSON.parse(jsonRequest.text).ZNode
    
    const explainPromptTemplate = new PromptTemplate({
      template: JSON_INTERPRETER,
      inputVariables: ["Json_Input", "Template_Input", "start", "end"],
    });
    const explainResponseChain = new LLMChain({ llm, prompt: explainPromptTemplate });
    const explainResponse = await explainResponseChain.call({
      Json_Input: JSON.stringify(response), 
      Template_Input: JSON.stringify(JSON_API_TEMPLATE),
      start: start,
      end: end
    })
    console.log('Step3, explain reponse', explainResponse.text)

    // convert into mermaid
    // const mermaidPromptTemplate = new PromptTemplate({
    //   template: MERMAID_INTERPRETER,
    //   inputVariables: ["start", "end", "input", "solution_template", "mermaid_template"],
    // })
    // const mermaidResponseChain = new LLMChain({ llm, prompt: mermaidPromptTemplate });
    // const mermaidResponse = await mermaidResponseChain.call({
    //   start: start,
    //   end: end,
    //   solution_template: SOLUTION_TEMPLATE,
    //   mermaid_template: MERMAID_TEMPLATE,
    //   input: explainResponse.replaceAll('(', '').replaceAll(')', '')
    // })
    // console.log('Step4, convert into mermaid', mermaidResponse.text)

    res.status(200).json({
      result: explainResponse.text,
      prompt: prompt,
      sqlQuery: jsonRequest.text,
      from: 'json'
    });
    
  } catch (e) {
    console.log('e', e );
    res.status(500)
    return Error('wrong request for api')
  }
};

export default handler;

